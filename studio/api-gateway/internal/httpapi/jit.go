package httpapi

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"
)

type JITAction struct {
	Type    string `json:"type"`
	ModelID string `json:"model_id"`
}

type modelActivity struct {
	active int
	idleAt time.Time
}

type jitFailure struct {
	message string
	at      time.Time
}

type JITManager struct {
	mu        sync.Mutex
	installed map[string]bool
	pending   map[string]bool
	failures  map[string]jitFailure
	stopping  map[string]bool
	activity  map[string]*modelActivity
	actions   []JITAction
}

func newJITManager() *JITManager {
	return &JITManager{
		installed: make(map[string]bool),
		pending:   make(map[string]bool),
		failures:  make(map[string]jitFailure),
		stopping:  make(map[string]bool),
		activity:  make(map[string]*modelActivity),
	}
}

func (j *JITManager) setInstalled(ids []string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.installed = make(map[string]bool, len(ids))
	for _, id := range ids {
		if id != "" {
			j.installed[id] = true
		}
	}
}

func (j *JITManager) registered(id string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.pending, id)
	delete(j.failures, id)
	delete(j.stopping, id)
	if j.activity[id] == nil {
		j.activity[id] = &modelActivity{idleAt: time.Now()}
	}
}

func (j *JITManager) unregistered(id string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.stopping, id)
	delete(j.activity, id)
}

func (j *JITManager) failed(id, message string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.pending, id)
	delete(j.stopping, id)
	j.failures[id] = jitFailure{message: message, at: time.Now()}
}

func (j *JITManager) queueStop(id string) {
	if !j.stopping[id] {
		j.stopping[id] = true
		j.actions = append(j.actions, JITAction{Type: "unload", ModelID: id})
	}
}

// Called with the JIT mutex held. Existing requests are allowed to finish.
func (j *JITManager) stopOtherJIT(id string, workers []Worker) bool {
	blocked := false
	for _, other := range workers {
		if !other.JIT || other.ModelID == id {
			continue
		}
		activity := j.activity[other.ModelID]
		if activity != nil && activity.active == 0 {
			j.queueStop(other.ModelID)
		}
		blocked = true
	}
	return blocked
}

func (j *JITManager) nextAction(cfg Config, workers []Worker) (JITAction, bool) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if cfg.AutoUnloadJITModels && cfg.JITModelLoading {
		now := time.Now()
		for _, worker := range workers {
			if !worker.JIT || j.stopping[worker.ModelID] {
				continue
			}
			activity := j.activity[worker.ModelID]
			if activity == nil {
				j.activity[worker.ModelID] = &modelActivity{idleAt: now}
				continue
			}
			if activity.active == 0 && now.Sub(activity.idleAt) >= time.Duration(cfg.MaxIdleTTLMinutes)*time.Minute {
				j.queueStop(worker.ModelID)
			}
		}
	}
	if len(j.actions) == 0 {
		return JITAction{}, false
	}
	action := j.actions[0]
	j.actions = j.actions[1:]
	return action, true
}

var errJITDisabled = errors.New("model is not loaded")

// acquire reserves a worker for the entire request, including streamed responses.
// The reservation and stop scheduling use one mutex to prevent unload during use.
func (s *Server) acquire(ctx context.Context, id string) (Worker, func(), int, string) {
	deadline := time.NewTimer(135 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(75 * time.Millisecond)
	defer ticker.Stop()

	for {
		s.jit.mu.Lock()
		worker, exists := s.registry.Resolve(id)
		if exists && !s.jit.stopping[id] {
			// Manually loaded workers are always available regardless of JIT policy.
			blocked := false
			if worker.JIT && s.cfg.JITModelLoading && s.cfg.OnlyKeepLastJITModel {
				blocked = s.jit.stopOtherJIT(id, s.registry.List())
			}
			if !blocked {
				activity := s.jit.activity[id]
				if activity == nil {
					activity = &modelActivity{}
					s.jit.activity[id] = activity
				}
				activity.active++
				s.jit.mu.Unlock()
				var once sync.Once
				return worker, func() {
					once.Do(func() {
						s.jit.mu.Lock()
						defer s.jit.mu.Unlock()
						activity.active--
						if activity.active == 0 {
							activity.idleAt = time.Now()
						}
					})
				}, 0, ""
			}
		}
		if !exists && !s.cfg.JITModelLoading {
			s.jit.mu.Unlock()
			return Worker{}, nil, http.StatusNotFound, errJITDisabled.Error()
		}
		if !exists && !s.jit.installed[id] && !s.jit.pending[id] {
			s.jit.mu.Unlock()
			return Worker{}, nil, http.StatusNotFound, "model is not installed"
		}
		if failure, failed := s.jit.failures[id]; failed && !exists {
			if time.Since(failure.at) < 2*time.Second {
				s.jit.mu.Unlock()
				return Worker{}, nil, http.StatusServiceUnavailable, "model failed to load: " + failure.message
			}
			delete(s.jit.failures, id)
		}
		if !exists && !s.jit.pending[id] && !s.jit.stopping[id] {
			blocked := false
			if s.cfg.OnlyKeepLastJITModel {
				for pending := range s.jit.pending {
					if pending != id {
						blocked = true
						break
					}
				}
				if s.jit.stopOtherJIT(id, s.registry.List()) {
					blocked = true
				}
			}
			if !blocked {
				s.jit.pending[id] = true
				s.jit.actions = append(s.jit.actions, JITAction{Type: "load", ModelID: id})
			}
		}
		s.jit.mu.Unlock()
		select {
		case <-ctx.Done():
			return Worker{}, nil, http.StatusRequestTimeout, "request cancelled while loading model"
		case <-deadline.C:
			s.jit.mu.Lock()
			delete(s.jit.pending, id)
			s.jit.mu.Unlock()
			return Worker{}, nil, http.StatusServiceUnavailable, "model loading timed out"
		case <-ticker.C:
		}
	}
}
