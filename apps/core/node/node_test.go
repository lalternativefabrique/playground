package node

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

func TestAssessReadsACrashLoopBehindReady(t *testing.T) {
	now := time.Now()
	recent := now.Add(-time.Minute)
	cases := []struct {
		name     string
		services []ServiceState
		status   string
		want     Verdict
	}{
		{"all up", []ServiceState{{Name: "web", State: "ready"}}, "running", VerdictHealthy},
		{"one broken", []ServiceState{{Name: "web", State: "ready"}, {Name: "db", State: "failed"}}, "running", VerdictDegraded},
		{"all broken", []ServiceState{{Name: "web", State: "failed"}}, "running", VerdictDown},
		{"flapping", []ServiceState{{Name: "web", State: "ready", Instances: []InstanceState{{Restarts: 4, StartedAt: &recent}}}}, "running", VerdictUnstable},
		{"held job", []ServiceState{{Name: "seed", State: "failed", Oneshot: true}}, "running", VerdictDown},
		{"starting", []ServiceState{{Name: "web", State: "starting"}}, "running", VerdictStarting},
		{"stopped", []ServiceState{{Name: "web", State: "ready"}}, "stopped", VerdictStopped},
		{"empty", nil, "running", VerdictUnknown},
	}
	for _, tc := range cases {
		if got := Assess(tc.services, tc.status, now).Verdict; got != tc.want {
			t.Errorf("%s: %s, want %s", tc.name, got, tc.want)
		}
	}
	if Worst([]Verdict{VerdictHealthy, VerdictDegraded, VerdictStarting}) != VerdictDegraded {
		t.Fatal("worst verdict")
	}
}

func fakeNode(t *testing.T, routes map[string]any) (*Client, *[]string) {
	t.Helper()
	var calls []string
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		calls = append(calls, r.Method+" "+r.URL.Path)
		body, ok := routes[r.Method+" "+r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		if s, isText := body.(string); isText {
			_, _ = io.WriteString(w, s)
			return
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
	t.Cleanup(srv.Close)
	sum := sha256.Sum256(srv.Certificate().Raw)
	c, err := NewClient(srv.URL, "tok", "sha256:"+hex.EncodeToString(sum[:]))
	if err != nil {
		t.Fatal(err)
	}
	return c, &calls
}

func TestOverviewJoinsSpacesToTheirReposAndRolls(t *testing.T) {
	rolledAt := time.Now()
	c, _ := fakeNode(t, map[string]any{
		"GET /v1/spaces": SpacesResponse{Node: "demo", Spaces: []SpaceInfo{
			{Name: "hello", Status: "running", Supervised: true},
			{Name: "bare", Status: "running"},
			{Name: "production", Status: "running", Supervised: true},
		}},
		"GET /v1/follows":                    FollowsResponse{Follows: []Follow{{Name: "hello-repo", Repo: "https://github.com/moi/hello", Branch: "main"}}},
		"GET /v1/watches":                    WatchesResponse{Watches: []Watch{{Name: "web", Space: "hello", Status: "rolling", Rolls: []Roll{{FromTag: "v1", ToTag: "v2", Result: "applied", CreatedAt: rolledAt}}}}},
		"GET /v1/spaces/hello/state":         StateResponse{Services: []ServiceState{{Name: "web", State: "ready", Image: "traefik/whoami:v1"}}},
		"GET /v1/spaces/production/state":    StateResponse{},
		"GET /v1/spaces/production/manifest": ManifestResponse{},
		"GET /v1/spaces/hello/manifest":      ManifestResponse{Stack: "hello-repo/web", Routes: []ManifestRoute{{Service: "web", Host: "hello.demo.example"}}},
	})
	svc := NewService(c, "playground")

	ov, err := svc.Overview(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(ov.Spaces) != 1 {
		t.Fatalf("a bare space and an empty one are not apps: %+v", ov.Spaces)
	}
	got := ov.Spaces[0]
	if got.Repo == nil || got.Repo.Repo != "https://github.com/moi/hello" || got.URL != "http://hello.demo.example" ||
		!got.Rolling || got.Health.Verdict != VerdictHealthy || got.Images[0] != "traefik/whoami:v1" {
		t.Fatalf("space view = %+v", got)
	}

	detail, err := svc.Space(context.Background(), "hello")
	if err != nil || len(detail.Services) != 1 || detail.Services[0].Routes[0] != "hello.demo.example" || len(detail.Watches[0].Rolls) != 1 {
		t.Fatalf("detail = %+v, %v", detail, err)
	}
	if _, err := svc.Space(context.Background(), "bare"); err != ErrNotFound {
		t.Fatalf("bare space detail: %v", err)
	}
}

func TestClientRefusesAnotherCertificate(t *testing.T) {
	srv := httptest.NewTLSServer(http.NotFoundHandler())
	t.Cleanup(srv.Close)
	c, err := NewClient(srv.URL, "tok", strings.Repeat("ab", 32))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Spaces(context.Background()); err == nil || !strings.Contains(err.Error(), "unreachable") {
		t.Fatalf("a certificate that is not the pinned one must be refused: %v", err)
	}
	if _, err := NewClient(srv.URL, "tok", ""); err == nil {
		t.Fatal("no pin, no client")
	}
}

func TestNodeRefusalsReachTheVisitor(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "follows: name hello is taken", http.StatusConflict)
	}))
	t.Cleanup(srv.Close)
	sum := sha256.Sum256(srv.Certificate().Raw)
	c, _ := NewClient(srv.URL, "tok", hex.EncodeToString(sum[:]))
	_, err := c.Follow(context.Background(), FollowRequest{Repo: "https://github.com/x/hello"})
	ne, ok := err.(*NodeError)
	if !ok || ne.Status != http.StatusConflict || !strings.Contains(ne.Message, "taken") {
		t.Fatalf("err = %v", err)
	}
}

func TestSocketClientSendsNoToken(t *testing.T) {
	dir, err := os.MkdirTemp("", "s")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	sock := filepath.Join(dir, "control.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			http.Error(w, "token sent", http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(SpacesResponse{Node: "demo"})
	})}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })
	got, err := NewSocketClient(sock).Spaces(context.Background())
	if err != nil || got.Node != "demo" {
		t.Fatalf("spaces over the socket: %+v, %v", got, err)
	}
}

func TestNextWipeIsTodayOrTomorrowInTheZone(t *testing.T) {
	paris, _ := time.LoadLocation("Europe/Paris")
	w := Wipe{Hour: 20, Zone: paris}
	before := time.Date(2026, 11, 27, 19, 59, 0, 0, paris)
	if got := w.Next(before); !got.Equal(time.Date(2026, 11, 27, 20, 0, 0, 0, paris)) {
		t.Fatalf("before 20:00: %v", got)
	}
	if got := w.Next(time.Date(2026, 11, 27, 20, 0, 0, 0, paris)); !got.Equal(time.Date(2026, 11, 28, 20, 0, 0, 0, paris)) {
		t.Fatalf("at 20:00: %v", got)
	}
}

func TestTheNodesOwnDemosCannotBeUnfollowed(t *testing.T) {
	c, calls := fakeNode(t, map[string]any{
		"GET /v1/follows": FollowsResponse{Follows: []Follow{
			{Name: "starter-test", Repo: "/home/architect/demo-repos/starter-test.git"},
			{Name: "mine", Repo: "https://github.com/me/mine"},
		}},
		"DELETE /v1/follows/mine": "",
	})
	e := echo.New()
	NewAPI(NewService(c, "playground"), PublicContext{}, Wipe{Hour: 20, Zone: time.UTC}, NewHostSampler("/proc", "/")).Register(e.Group("/api/v1"))
	for name, want := range map[string]int{"starter-test": http.StatusForbidden, "mine": http.StatusNoContent} {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/v1/follows/"+name, nil))
		if rec.Code != want {
			t.Errorf("unfollow %s: %d, want %d", name, rec.Code, want)
		}
	}
	for _, call := range *calls {
		if call == "DELETE /v1/follows/starter-test" {
			t.Fatal("a pinned follow reached the node")
		}
	}
}
