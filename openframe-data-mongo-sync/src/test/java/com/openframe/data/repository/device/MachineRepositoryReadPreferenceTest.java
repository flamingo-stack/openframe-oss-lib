package com.openframe.data.repository.device;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.repository.ReadPreference;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class MachineRepositoryReadPreferenceTest {

    @Test
    void reproducesBug_CU17tkuw65zpy_existsByMachineId_readsPrimary() throws NoSuchMethodException {
        // setup
        Method existsByMachineId = MachineRepository.class.getMethod("existsByMachineId", String.class);

        // execution
        ReadPreference readPreference = existsByMachineId.getAnnotation(ReadPreference.class);

        // verifications
        assertThat(readPreference.value()).isEqualTo("primary");
    }
}
