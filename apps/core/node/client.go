package node

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var ErrNotFound = errors.New("not found")

// NodeError is a refusal the node phrased itself; Status is its HTTP code.
type NodeError struct {
	Status  int
	Message string
}

func (e *NodeError) Error() string { return e.Message }

type Client struct {
	base   string
	token  string
	http   *http.Client
	stream *http.Client
}

func NewClient(server, token, fingerprint string) (*Client, error) {
	if server == "" || token == "" {
		return nil, errors.New("node: server and token are required")
	}
	pin := normalizeFingerprint(fingerprint)
	if len(pin) != sha256.Size*2 {
		return nil, errors.New("node: a sha256 certificate fingerprint is required")
	}
	if !strings.Contains(server, "://") {
		server = "https://" + server
	}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: true, // the node's certificate is self-signed: VerifyPeerCertificate pins it instead
			VerifyPeerCertificate: func(raw [][]byte, _ [][]*x509.Certificate) error {
				if len(raw) == 0 {
					return errors.New("node: no certificate presented")
				}
				sum := sha256.Sum256(raw[0])
				if hex.EncodeToString(sum[:]) != pin {
					return errors.New("node: certificate does not match the pinned fingerprint")
				}
				return nil
			},
		},
		MaxIdleConnsPerHost: 16,
	}
	return &Client{
		base:   strings.TrimRight(server, "/"),
		token:  token,
		http:   &http.Client{Transport: transport, Timeout: 8 * time.Second},
		stream: &http.Client{Transport: transport},
	}, nil
}

// NewSocketClient talks to the node over the control socket it mounts in a
// granted service: the socket is the credential, no token and no TLS.
func NewSocketClient(path string) *Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", path)
		},
	}
	return &Client{
		base:   "http://node",
		http:   &http.Client{Transport: transport, Timeout: 8 * time.Second},
		stream: &http.Client{Transport: transport},
	}
}

func normalizeFingerprint(fp string) string {
	fp = strings.ToLower(strings.TrimSpace(fp))
	fp = strings.TrimPrefix(fp, "sha256:")
	return strings.ReplaceAll(fp, ":", "")
}

func spacePath(space, route string) string {
	return "/v1/spaces/" + url.PathEscape(space) + route
}

func (c *Client) Spaces(ctx context.Context) (SpacesResponse, error) {
	var out SpacesResponse
	return out, c.getJSON(ctx, "/v1/spaces", &out)
}

func (c *Client) State(ctx context.Context, space string) (StateResponse, error) {
	var out StateResponse
	return out, c.getJSON(ctx, spacePath(space, "/state"), &out)
}

func (c *Client) Manifest(ctx context.Context, space string) (ManifestResponse, error) {
	var out ManifestResponse
	return out, c.getJSON(ctx, spacePath(space, "/manifest"), &out)
}

func (c *Client) Follows(ctx context.Context) (FollowsResponse, error) {
	var out FollowsResponse
	err := c.getJSON(ctx, "/v1/follows", &out)
	out.Follows = pin(out.Follows)
	return out, err
}

// Watches answers an empty list on a node too old to serve the route.
func (c *Client) Watches(ctx context.Context) (WatchesResponse, error) {
	var out WatchesResponse
	err := c.getJSON(ctx, "/v1/watches", &out)
	if errors.Is(err, ErrNotFound) {
		return WatchesResponse{}, nil
	}
	return out, err
}

func (c *Client) Follow(ctx context.Context, req FollowRequest) (Follow, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return Follow{}, err
	}
	resp, err := c.do(ctx, c.http, http.MethodPost, "/v1/follows", bytes.NewReader(body))
	if err != nil {
		return Follow{}, err
	}
	defer resp.Body.Close()
	var out Follow
	return out, json.NewDecoder(resp.Body).Decode(&out)
}

func (c *Client) Unfollow(ctx context.Context, name string) error {
	resp, err := c.do(ctx, c.http, http.MethodDelete, "/v1/follows/"+url.PathEscape(name), nil)
	if err != nil {
		return err
	}
	return resp.Body.Close()
}

func (c *Client) Restart(ctx context.Context, space, service string) error {
	resp, err := c.do(ctx, c.http, http.MethodPost, spacePath(space, "/restart/"+url.PathEscape(service)), nil)
	if err != nil {
		return err
	}
	return resp.Body.Close()
}

// Logs streams a service's log; the caller closes it.
func (c *Client) Logs(ctx context.Context, space, service string, follow bool) (io.ReadCloser, error) {
	path := spacePath(space, "/logs/"+url.PathEscape(service))
	if follow {
		path += "?follow=1"
	}
	resp, err := c.do(ctx, c.stream, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (c *Client) getJSON(ctx context.Context, path string, out any) error {
	resp, err := c.do(ctx, c.http, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) do(ctx context.Context, client *http.Client, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, body)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("node unreachable: %w", err)
	}
	if resp.StatusCode < 300 {
		return resp, nil
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	switch {
	case resp.StatusCode == http.StatusNotFound && method == http.MethodGet:
		return nil, ErrNotFound
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return nil, &NodeError{Status: http.StatusBadGateway, Message: "the demo node refused this request: " + strings.TrimSpace(string(msg))}
	default:
		return nil, &NodeError{Status: resp.StatusCode, Message: strings.TrimSpace(string(msg))}
	}
}
