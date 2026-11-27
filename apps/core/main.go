package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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
	client, err := node.NewClient(envOr("DEMO_NODE_URL", public.Server), public.Token, public.CAFingerprint)
	if err != nil {
		log.Fatal(err)
	}

	e := echo.New()
	e.HideBanner = true
	e.Use(emw.Recover(), emw.RequestID())
	health.Register(e)
	node.NewAPI(node.NewService(client), public).Register(e.Group("/api/v1"))

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

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
