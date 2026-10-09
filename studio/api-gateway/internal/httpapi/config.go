package httpapi

import (
	"errors"
	"fmt"
	"net"
	"os"
)

type Config struct {
	Addr         string
	APIKey       string
	ControlToken string
	CORS         bool
}

func ConfigFromEnv() (Config, error) {
	cfg := Config{
		Addr:         os.Getenv("TIDE_GATEWAY_ADDR"),
		APIKey:       os.Getenv("TIDE_GATEWAY_API_KEY"),
		ControlToken: os.Getenv("TIDE_GATEWAY_CONTROL_TOKEN"),
		CORS:         os.Getenv("TIDE_GATEWAY_CORS") == "true",
	}

	if cfg.Addr == "" {
		cfg.Addr = "127.0.0.1:8080"
	}
	if cfg.ControlToken == "" {
		return cfg, errors.New("missing internal control token")
	}
	if _, _, err := net.SplitHostPort(cfg.Addr); err != nil {
		return cfg, fmt.Errorf("invalid listen address: %w", err)
	}
	return cfg, nil
}
