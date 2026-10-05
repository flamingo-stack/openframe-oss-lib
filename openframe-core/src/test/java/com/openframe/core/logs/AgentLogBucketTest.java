package com.openframe.core.logs;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class AgentLogBucketTest {

    /**
     * Golden values, not a property. The writer and the reader live in different repositories and a one-byte
     * disagreement returns no logs at all with no error, so both sides pin these literals: a change here is a change to
     * where every existing log line can be found.
     * <p>
     * Cross-checked outside the JVM: Python's {@code zlib.crc32(b"machine-a") % 16} is 1 too, which is the property
     * that makes CRC32 safe here and {@code String.hashCode()} not.
     */
    @Test
    @DisplayName("known machine ids map to these exact buckets, in any language")
    void pinsKnownMachineIdsToKnownBuckets() {
        assertThat(AgentLogBucket.of("machine-a")).isEqualTo(1);
        assertThat(AgentLogBucket.of("machine-b")).isEqualTo(11);
        assertThat(AgentLogBucket.of("00000000-0000-0000-0000-000000000000")).isEqualTo(9);
        assertThat(AgentLogBucket.label("machine-a")).isEqualTo("1");
    }

    @Test
    void neverLeavesTheBucketRange() {
        Set<Integer> seen = new HashSet<>();
        IntStream.range(0, 5_000).forEach(i -> seen.add(AgentLogBucket.of("machine-" + i)));

        assertThat(seen).allMatch(bucket -> bucket >= 0 && bucket < AgentLogBucket.BUCKET_COUNT);
        // A hash that collapsed everything into a few buckets would give the index nothing to skip
        assertThat(seen).hasSize(AgentLogBucket.BUCKET_COUNT);
    }

    @Test
    @DisplayName("blank ids share bucket 0, matching the writer, which stamps no machine_id for them")
    void treatsBlankAndNullAlike() {
        assertThat(AgentLogBucket.of(null)).isZero();
        assertThat(AgentLogBucket.of("")).isZero();
    }

    @Test
    void isStableAcrossCalls() {
        assertThat(AgentLogBucket.of("machine-a")).isEqualTo(AgentLogBucket.of("machine-a"));
    }
}
