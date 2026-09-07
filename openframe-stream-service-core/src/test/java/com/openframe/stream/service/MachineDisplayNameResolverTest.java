package com.openframe.stream.service;

import com.openframe.data.model.redis.CachedMachineInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MachineDisplayNameResolverTest {

    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String ORG_ID = "e0521785-8fef-4ec3-b520-f99087ed988e";
    private static final String HOSTNAME = "MBP-Oleksandr.lan";
    private static final String NICKNAME = "Reception iMac";

    private final MachineDisplayNameResolver resolver = new MachineDisplayNameResolver();

    @Test
    @DisplayName("nickname is used when the device has one")
    void resolveDisplayName_returnsNicknameWhenPresent() {
        CachedMachineInfo machine = new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID);

        assertThat(resolver.resolveDisplayName(machine)).isEqualTo(NICKNAME);
    }

    @Test
    @DisplayName("hostname stands when no nickname is set")
    void resolveDisplayName_fallsBackToHostnameWhenNicknameMissing() {
        CachedMachineInfo machine = new CachedMachineInfo(MACHINE_ID, HOSTNAME, null, ORG_ID);

        assertThat(resolver.resolveDisplayName(machine)).isEqualTo(HOSTNAME);
    }

    @Test
    @DisplayName("a blank nickname is not a nickname — hostname stands")
    void resolveDisplayName_fallsBackToHostnameWhenNicknameBlank() {
        CachedMachineInfo machine = new CachedMachineInfo(MACHINE_ID, HOSTNAME, "   ", ORG_ID);

        assertThat(resolver.resolveDisplayName(machine)).isEqualTo(HOSTNAME);
    }
}
