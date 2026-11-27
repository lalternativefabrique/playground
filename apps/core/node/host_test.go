package node

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeProc(t *testing.T, dir, user, idle string) {
	t.Helper()
	stat := "cpu  " + user + " 0 0 " + idle + " 0 0 0 0 0 0\ncpu0 1 0 0 1 0 0 0 0 0 0\ncpu1 1 0 0 1 0 0 0 0 0 0\nintr 1\n"
	files := map[string]string{
		"stat":    stat,
		"meminfo": "MemTotal:       4000000 kB\nMemFree:  100 kB\nMemAvailable:   1000000 kB\n",
		"loadavg": "0.42 0.30 0.20 1/100 1234\n",
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestHostSamplerReadsTheMachine(t *testing.T) {
	dir := t.TempDir()
	h := NewHostSampler(dir, dir)
	now := time.Now()

	writeProc(t, dir, "100", "900")
	if err := h.Sample(now); err != nil {
		t.Fatal(err)
	}
	if got := h.Resources(); len(got.Samples) != 0 || got.CPUs != 2 || got.MemTotal != 4000000*1024 {
		t.Fatalf("first read only primes the CPU counters: %+v", got)
	}

	writeProc(t, dir, "350", "1650")
	if err := h.Sample(now.Add(10 * time.Second)); err != nil {
		t.Fatal(err)
	}
	got := h.Resources()
	if len(got.Samples) != 1 {
		t.Fatalf("samples: %+v", got.Samples)
	}
	s := got.Samples[0]
	if s.CPU < 24.9 || s.CPU > 25.1 || s.MemUsed != 3000000*1024 || s.Load1 != 0.42 || got.DiskTotal == 0 {
		t.Fatalf("sample = %+v, resources = %+v", s, got)
	}
}
