package com.openframe.api.service.rmm.schedule;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleDeviceChangeTest {

    @Test
    void between_deviceRepeatedInTheRequest_listsItAddedOnce() {
        ScheduleDeviceChange change = ScheduleDeviceChange.between(List.of(), List.of("m-1", "m-1"), false);

        assertThat(change.added()).containsExactly("m-1");
    }

    @ParameterizedTest
    @MethodSource("singleChanges")
    void isEmpty_onlyOneKindOfChange_isFalse(ScheduleDeviceChange change) {
        assertThat(change.isEmpty()).isFalse();
    }

    static Stream<ScheduleDeviceChange> singleChanges() {
        return Stream.of(
                new ScheduleDeviceChange(List.of("m-1"), List.of(), false),
                new ScheduleDeviceChange(List.of(), List.of("m-1"), false),
                new ScheduleDeviceChange(List.of(), List.of(), true));
    }
}
