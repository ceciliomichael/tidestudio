package httpapi

import (
	"errors"
	"sort"
	"sync"
)

type Worker struct {
	ModelID  string            `json:"model_id"`
	BaseURL  string            `json:"base_url"`
	Defaults InferenceDefaults `json:"defaults"`
	JIT      bool              `json:"jit"`
}

type InferenceDefaults struct {
	SystemPrompt      string   `json:"systemPrompt"`
	ThinkingEnabled   *bool    `json:"thinkingEnabled"`
	ReasoningEffort   string   `json:"reasoningEffort"`
	ReasoningBudget   *int     `json:"reasoningBudget"`
	ReasoningPreserve *bool    `json:"reasoningPreserve"`
	Temperature       *float64 `json:"temperature"`
	TopK              *int     `json:"topK"`
	TopP              *float64 `json:"topP"`
	MinP              *float64 `json:"minP"`
	TypicalP          *float64 `json:"typicalP"`
	Seed              *int64   `json:"seed"`
	RepeatPenalty     *float64 `json:"repeatPenalty"`
	PresencePenalty   *float64 `json:"presencePenalty"`
	FrequencyPenalty  *float64 `json:"frequencyPenalty"`
}

type Registry struct {
	mu      sync.RWMutex
	workers map[string]Worker
}

func NewRegistry() *Registry { return &Registry{workers: make(map[string]Worker)} }

func (r *Registry) Register(w Worker) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if old, ok := r.workers[w.ModelID]; ok && old.BaseURL != w.BaseURL {
		return errors.New("model already registered")
	}
	r.workers[w.ModelID] = w
	return nil
}

func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.workers, id)
}

func (r *Registry) Resolve(id string) (Worker, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	w, ok := r.workers[id]
	return w, ok
}

func (r *Registry) List() []Worker {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]Worker, 0, len(r.workers))
	for _, w := range r.workers {
		list = append(list, w)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].ModelID < list[j].ModelID })
	return list
}
