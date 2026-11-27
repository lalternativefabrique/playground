package node

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// A container on the node reads the machine's own /proc (no lxcfs on sklp
// spaces), so the console samples the node's load without asking it.
const (
	hostEvery  = 10 * time.Second
	hostWindow = 360
)

type HostSample struct {
	At       time.Time `json:"at"`
	CPU      float64   `json:"cpu_pct"`
	MemUsed  uint64    `json:"mem_used"`
	DiskUsed uint64    `json:"disk_used"`
	Load1    float64   `json:"load1"`
}

type HostResources struct {
	CPUs      int          `json:"cpus"`
	MemTotal  uint64       `json:"mem_total"`
	DiskTotal uint64       `json:"disk_total"`
	Samples   []HostSample `json:"samples"`
}

type HostSampler struct {
	proc string
	disk string

	mu        sync.Mutex
	cpus      int
	memTotal  uint64
	diskTotal uint64
	samples   []HostSample
	lastBusy  uint64
	lastTotal uint64
}

func NewHostSampler(proc, disk string) *HostSampler {
	return &HostSampler{proc: proc, disk: disk}
}

func (h *HostSampler) Run(ctx context.Context) {
	tick := time.NewTicker(hostEvery)
	defer tick.Stop()
	for {
		if err := h.Sample(time.Now()); err != nil {
			fmt.Fprintf(os.Stderr, "host sample: %v\n", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (h *HostSampler) Sample(now time.Time) error {
	busy, total, cpus, err := h.readCPU()
	if err != nil {
		return err
	}
	memTotal, memAvail, err := h.readMem()
	if err != nil {
		return err
	}
	load1, err := h.readLoad()
	if err != nil {
		return err
	}
	var fs syscall.Statfs_t
	if err := syscall.Statfs(h.disk, &fs); err != nil {
		return err
	}
	diskTotal := fs.Blocks * uint64(fs.Bsize)
	diskUsed := diskTotal - fs.Bavail*uint64(fs.Bsize)

	h.mu.Lock()
	defer h.mu.Unlock()
	h.cpus, h.memTotal, h.diskTotal = cpus, memTotal, diskTotal
	defer func() { h.lastBusy, h.lastTotal = busy, total }()
	if h.lastTotal == 0 || total <= h.lastTotal {
		return nil
	}
	cpu := 100 * float64(busy-h.lastBusy) / float64(total-h.lastTotal)
	h.samples = append(h.samples, HostSample{At: now.UTC(), CPU: cpu, MemUsed: memTotal - memAvail, DiskUsed: diskUsed, Load1: load1})
	if len(h.samples) > hostWindow {
		h.samples = h.samples[len(h.samples)-hostWindow:]
	}
	return nil
}

func (h *HostSampler) Resources() HostResources {
	h.mu.Lock()
	defer h.mu.Unlock()
	return HostResources{CPUs: h.cpus, MemTotal: h.memTotal, DiskTotal: h.diskTotal, Samples: append([]HostSample{}, h.samples...)}
}

func (h *HostSampler) readCPU() (busy, total uint64, cpus int, err error) {
	f, err := os.Open(h.proc + "/stat")
	if err != nil {
		return 0, 0, 0, err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) == 0 || !strings.HasPrefix(fields[0], "cpu") {
			continue
		}
		if fields[0] != "cpu" {
			cpus++
			continue
		}
		for i, v := range fields[1:] {
			n, perr := strconv.ParseUint(v, 10, 64)
			if perr != nil {
				return 0, 0, 0, perr
			}
			total += n
			if i != 3 && i != 4 {
				busy += n
			}
		}
	}
	return busy, total, cpus, sc.Err()
}

func (h *HostSampler) readMem() (total, avail uint64, err error) {
	f, err := os.Open(h.proc + "/meminfo")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		kb, perr := strconv.ParseUint(fields[1], 10, 64)
		if perr != nil {
			continue
		}
		switch fields[0] {
		case "MemTotal:":
			total = kb * 1024
		case "MemAvailable:":
			avail = kb * 1024
		}
	}
	if total == 0 {
		return 0, 0, fmt.Errorf("%s/meminfo: no MemTotal", h.proc)
	}
	return total, avail, sc.Err()
}

func (h *HostSampler) readLoad() (float64, error) {
	data, err := os.ReadFile(h.proc + "/loadavg")
	if err != nil {
		return 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0, fmt.Errorf("%s/loadavg: empty", h.proc)
	}
	return strconv.ParseFloat(fields[0], 64)
}
