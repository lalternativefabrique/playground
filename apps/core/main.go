package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/labstack/echo/v4"
	emw "github.com/labstack/echo/v4/middleware"

	"playground/core/health"
	"playground/core/node"
)

func main() {
	public := node.PublicContext{
		Name:          envOr("DEMO_CONTEXT_NAME", "demo"),
		Server:        os.Getenv("DEMO_NODE_PUBLIC_URL"),
		Token:         os.Getenv("DEMO_NODE_TOKEN"),
		CAFingerprint: os.Getenv("DEMO_NODE_CA_FINGERPRINT"),
	}
	client, err := nodeClient(public)
	if err != nil {
		log.Fatal(err)
	}

	e := echo.New()
	e.HideBanner = true
	e.Use(emw.Recover(), emw.RequestID())
	health.Register(e)
	wipe, err := wipeFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	node.NewAPI(node.NewService(client), public, wipe).Register(e.Group("/api/v1"))

	port := envOr("PORT", "4100")
	log.Printf("core listening on :%s", port)
	go func() {
		if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	drainCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := e.Shutdown(drainCtx); err != nil {
		log.Printf("http shutdown: %v", err)
	}
}

// nodeClient prefers the control socket the node mounts in a granted
// service; the token is then only shown to visitors, never used.
func nodeClient(public node.PublicContext) (*node.Client, error) {
	sock := envOr("DEMO_NODE_SOCKET", "/run/sklp/control.sock")
	if _, err := os.Stat(sock); err == nil {
		log.Printf("node: control socket %s", sock)
		return node.NewSocketClient(sock), nil
	}
	return node.NewClient(envOr("DEMO_NODE_URL", public.Server), public.Token, public.CAFingerprint)
}

func wipeFromEnv() (node.Wipe, error) {
	zone, err := time.LoadLocation(envOr("DEMO_WIPE_ZONE", "Europe/Paris"))
	if err != nil {
		return node.Wipe{}, err
	}
	hour, err := strconv.Atoi(envOr("DEMO_WIPE_HOUR", "20"))
	if err != nil || hour < 0 || hour > 23 {
		return node.Wipe{}, fmt.Errorf("DEMO_WIPE_HOUR: want 0-23")
	}
	return node.Wipe{Hour: hour, Zone: zone}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
