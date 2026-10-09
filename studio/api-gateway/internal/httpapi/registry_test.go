package httpapi

import (
	"fmt"
	"sync"
	"testing"
)

func TestRegistryConcurrentReadersAndWriters(t *testing.T) {
	registry := NewRegistry()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			id := fmt.Sprintf("model-%d", index)
			if err := registry.Register(Worker{
				ModelID: id,
				BaseURL: "http://127.0.0.1:12345",
			}); err != nil {
				t.Error(err)
			}
			_, _ = registry.Resolve(id)
			_ = registry.List()
		}(i)
	}
	wg.Wait()
	if len(registry.List()) != 50 {
		t.Fatal("lost registered workers")
	}
}
