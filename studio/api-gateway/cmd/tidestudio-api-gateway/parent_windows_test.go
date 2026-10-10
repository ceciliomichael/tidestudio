//go:build windows

package main

import (
	"os/exec"
	"testing"
	"time"
)

func TestWatchParentExit(t *testing.T) {
	parent := exec.Command("cmd.exe", "/c", "ping -n 30 127.0.0.1 >nul")
	if err := parent.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = parent.Process.Kill()
		_ = parent.Wait()
	}()

	exited := make(chan struct{}, 1)
	if err := watchParentExit(uint32(parent.Process.Pid), func() { exited <- struct{}{} }); err != nil {
		t.Fatal(err)
	}
	if err := parent.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-exited:
	case <-time.After(5 * time.Second):
		t.Fatal("parent exit did not trigger gateway shutdown")
	}
}

func TestWatchParentExitRejectsInvalidPid(t *testing.T) {
	if err := watchParentExit(0, func() {}); err == nil {
		t.Fatal("expected invalid parent PID to be rejected")
	}
}
