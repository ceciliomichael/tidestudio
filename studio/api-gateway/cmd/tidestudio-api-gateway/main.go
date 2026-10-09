package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tidestudio/api-gateway/internal/httpapi"
)

func main() {
	cfg, err := httpapi.ConfigFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.New(cfg),
		ReadHeaderTimeout: 10 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-quit
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	log.Printf("TideStudio API gateway listening on %s", cfg.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
