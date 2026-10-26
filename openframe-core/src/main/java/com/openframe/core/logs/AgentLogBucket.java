package com.openframe.core.logs;

import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

/**
 * Splits a tenant's agent-log streams into a fixed number of parts, keyed by machine id.
 * <p>
 * Loki indexes stream labels only. {@code machine_id} is per-line structured metadata, so a per-device query can be
 * narrowed by the index no further than "everything this tenant ever logged", and every chunk of it is fetched and
 * decompressed before the machine filter runs. A small {@code bucket} label cuts that to a sixteenth while staying far
 * away from the cardinality that made {@code machine_id} itself unusable as a label: 16 values that never change,
 * against ~1,100 that changed constantly.
 * <p>
 * Writer ({@code openframe-saas-logs-stream}) and reader (the device-logs API) must agree exactly - a single-byte
 * disagreement returns no logs at all, with no error - so both call this, and both pin the same golden values in tests.
 * CRC32 rather than {@link String#hashCode()} because the algorithm is specified and identical in every language, which
 * {@code hashCode} is not guaranteed to be outside the JDK.
 */
public final class AgentLogBucket {

    /**
     * Fixed for the life of the data. Changing it makes existing logs unreachable at their new bucket, so it is only
     * safe to change after {@code {job="agent-logs"}} retention has rolled over everything written with the old value.
     */
    public static final int BUCKET_COUNT = 16;

    private AgentLogBucket() {
    }

    /**
     * Blank machine ids all land in bucket 0, matching the writer: it omits the {@code machine_id} metadata entirely
     * for those, so nothing can query them by device anyway.
     */
    public static int of(String machineId) {
        CRC32 crc = new CRC32();
        if (machineId != null) {
            crc.update(machineId.getBytes(StandardCharsets.UTF_8));
        }
        return (int) (crc.getValue() % BUCKET_COUNT);
    }

    public static String label(String machineId) {
        return Integer.toString(of(machineId));
    }
}
