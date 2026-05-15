package com.openframe.data.integration.support;

import java.util.Arrays;
import java.util.function.LongSupplier;

public record MeasurementStats(int samples,
                               long min,
                               long max,
                               long mean,
                               long p50,
                               long p95,
                               long p99) {

    public static MeasurementStats measure(int warmup, int samples, LongSupplier op) {
        if (samples <= 0) {
            throw new IllegalArgumentException("samples must be > 0, got " + samples);
        }
        for (int i = 0; i < warmup; i++) {
            op.getAsLong();
        }
        long[] data = new long[samples];
        for (int i = 0; i < samples; i++) {
            data[i] = op.getAsLong();
        }
        long[] sorted = data.clone();
        Arrays.sort(sorted);
        long sum = 0;
        for (long v : sorted) {
            sum += v;
        }
        return new MeasurementStats(samples,
                sorted[0],
                sorted[samples - 1],
                sum / samples,
                percentile(sorted, 50),
                percentile(sorted, 95),
                percentile(sorted, 99));
    }

    public static long timeMillis(Runnable op) {
        long start = System.nanoTime();
        op.run();
        return (System.nanoTime() - start) / 1_000_000L;
    }

    private static long percentile(long[] sorted, int pct) {
        if (sorted.length == 0) {
            return 0L;
        }
        int idx = (int) Math.ceil(pct / 100.0 * sorted.length) - 1;
        if (idx < 0) {
            idx = 0;
        }
        if (idx >= sorted.length) {
            idx = sorted.length - 1;
        }
        return sorted[idx];
    }
}
