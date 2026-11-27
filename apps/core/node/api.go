package node

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/labstack/echo/v4"
)

var nameRE = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{0,62}$`)

// PublicContext is what a visitor's sklp needs to reach the demo node. The
// demo node is public by design: its token is handed to anyone who asks.
type PublicContext struct {
	Name          string `json:"name"`
	Server        string `json:"server"`
	Token         string `json:"token"`
	CAFingerprint string `json:"ca_fingerprint"`
	WipesAt       string `json:"wipes_at"`
	WipeLabel     string `json:"wipe_label"`
}

// Wipe is the daily reset of the public node, in the operator's time zone.
type Wipe struct {
	Hour int
	Zone *time.Location
}

func (w Wipe) Next(now time.Time) time.Time {
	local := now.In(w.Zone)
	at := time.Date(local.Year(), local.Month(), local.Day(), w.Hour, 0, 0, 0, w.Zone)
	if !at.After(local) {
		at = at.AddDate(0, 0, 1)
	}
	return at
}

type API struct {
	svc     *Service
	context PublicContext
	wipe    Wipe
}

func NewAPI(svc *Service, public PublicContext, wipe Wipe) *API {
	return &API{svc: svc, context: public, wipe: wipe}
}

func (a *API) Register(g *echo.Group) {
	g.GET("/context", a.getContext)
	g.GET("/spaces", a.listSpaces)
	g.GET("/spaces/:space", a.getSpace)
	g.GET("/spaces/:space/logs/:service", a.streamLogs)
	g.POST("/spaces/:space/services/:service/restart", a.restart)
	g.GET("/follows", a.listFollows)
	g.POST("/follows", a.follow)
	g.DELETE("/follows/:name", a.unfollow)
}

func (a *API) getContext(c echo.Context) error {
	out := a.context
	out.WipesAt = a.wipe.Next(time.Now()).UTC().Format(time.RFC3339)
	out.WipeLabel = fmt.Sprintf("%02d:00 (%s)", a.wipe.Hour, a.wipe.Zone)
	return c.JSON(http.StatusOK, out)
}

func (a *API) listSpaces(c echo.Context) error {
	out, err := a.svc.Overview(c.Request().Context())
	if err != nil {
		return nodeError(err)
	}
	return c.JSON(http.StatusOK, out)
}

func (a *API) getSpace(c echo.Context) error {
	space := c.Param("space")
	if !nameRE.MatchString(space) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid space name")
	}
	out, err := a.svc.Space(c.Request().Context(), space)
	if err != nil {
		return nodeError(err)
	}
	return c.JSON(http.StatusOK, out)
}

func (a *API) streamLogs(c echo.Context) error {
	space, service := c.Param("space"), c.Param("service")
	if !nameRE.MatchString(space) || !nameRE.MatchString(service) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid space or service name")
	}
	follow := c.QueryParam("follow") == "1"
	body, err := a.svc.client.Logs(c.Request().Context(), space, service, follow)
	if err != nil {
		return nodeError(err)
	}
	defer body.Close()
	res := c.Response()
	res.Header().Set(echo.HeaderContentType, "text/plain; charset=utf-8")
	res.Header().Set("Cache-Control", "no-store")
	res.Header().Set("X-Accel-Buffering", "no")
	res.WriteHeader(http.StatusOK)
	buf := make([]byte, 16<<10)
	for {
		n, rerr := body.Read(buf)
		if n > 0 {
			if _, werr := res.Write(buf[:n]); werr != nil {
				return nil
			}
			res.Flush()
		}
		if rerr != nil {
			if !errors.Is(rerr, io.EOF) && !errors.Is(rerr, context.Canceled) {
				c.Logger().Warnf("logs %s/%s: %v", space, service, rerr)
			}
			return nil
		}
	}
}

func (a *API) restart(c echo.Context) error {
	space, service := c.Param("space"), c.Param("service")
	if !nameRE.MatchString(space) || !nameRE.MatchString(service) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid space or service name")
	}
	if err := a.svc.client.Restart(c.Request().Context(), space, service); err != nil {
		return nodeError(err)
	}
	return c.NoContent(http.StatusAccepted)
}

func (a *API) listFollows(c echo.Context) error {
	out, err := a.svc.client.Follows(c.Request().Context())
	if err != nil {
		return nodeError(err)
	}
	return c.JSON(http.StatusOK, nonNil(out.Follows))
}

func (a *API) follow(c echo.Context) error {
	var req FollowRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	out, err := a.svc.client.Follow(c.Request().Context(), req)
	if err != nil {
		return nodeError(err)
	}
	return c.JSON(http.StatusCreated, out)
}

func (a *API) unfollow(c echo.Context) error {
	name := c.Param("name")
	if !nameRE.MatchString(name) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid name")
	}
	if err := a.svc.client.Unfollow(c.Request().Context(), name); err != nil {
		return nodeError(err)
	}
	return c.NoContent(http.StatusNoContent)
}

func nodeError(err error) error {
	var ne *NodeError
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, "not found on the demo node")
	case errors.As(err, &ne):
		return echo.NewHTTPError(ne.Status, ne.Message)
	default:
		return echo.NewHTTPError(http.StatusBadGateway, "the demo node is unreachable")
	}
}
