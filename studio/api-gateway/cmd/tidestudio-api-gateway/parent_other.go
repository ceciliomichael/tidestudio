//go:build !windows

package main

// Native process supervision is currently implemented for Windows desktops.
func watchParentExit(_ uint32, _ func()) error { return nil }
