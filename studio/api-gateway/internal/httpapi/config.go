package httpapi

import (
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
)

type Config struct {
	Addr                 string
	APIKey               string
	ControlToken         string
	CORS                 bool
	JITModelLoading      bool
	AutoUnloadJITModels  bool
	MaxIdleTTLMinutes    int
	OnlyKeepLastJITModel bool
}

func ConfigFromEnv() (Config, error) {
	cfg := Config{
		Addr:                 os.Getenv("TIDE_GATEWAY_ADDR"),
		APIKey:               os.Getenv("TIDE_GATEWAY_API_KEY"),
		ControlToken:         os.Getenv("TIDE_GATEWAY_CONTROL_TOKEN"),
		CORS:                 os.Getenv("TIDE_GATEWAY_CORS") == "true",
		JITModelLoading:      os.Getenv("TIDE_GATEWAY_JIT") == "true",
		AutoUnloadJITModels:  os.Getenv("TIDE_GATEWAY_AUTO_UNLOAD") == "true",
		OnlyKeepLastJITModel: os.Getenv("TIDE_GATEWAY_KEEP_LAST") == "true",
		MaxIdleTTLMinutes:    60,
	}

	if cfg.Addr == "" {
		cfg.Addr = "127.0.0.1:8080"
	}
	if value := os.Getenv("TIDE_GATEWAY_IDLE_TTL"); value != "" {
		minutes, err := strconv.Atoi(value)
		if err != nil || minutes < 1 || minutes > 525600 {
			return cfg, errors.New("invalid JIT idle TTL minutes")
		}
		cfg.MaxIdleTTLMinutes = minutes
	}
	if cfg.ControlToken == "" {
		return cfg, errors.New("missing internal control token")
	}
	if _, _, err := net.SplitHostPort(cfg.Addr); err != nil {
		return cfg, fmt.Errorf("invalid listen address: %w", err)
	}
	return cfg, nil
}
