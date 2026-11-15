package com.openframe.data.document.device;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MachineTest {

    @Test
    void deviceName_nickname_returnsTheNickname() {
        assertThat(machine("Reception PC", "Anna's laptop", "DESKTOP-4F2K").deviceName()).isEqualTo("Reception PC");
    }

    @Test
    void deviceName_noNickname_returnsTheDisplayName() {
        assertThat(machine(null, "Anna's laptop", "DESKTOP-4F2K").deviceName()).isEqualTo("Anna's laptop");
    }

    @Test
    void deviceName_blankNicknameAndDisplayName_returnsTheHostname() {
        assertThat(machine(" ", "", "DESKTOP-4F2K").deviceName()).isEqualTo("DESKTOP-4F2K");
    }

    @Test
    void deviceName_noNameAtAll_returnsNull() {
        assertThat(machine(null, null, null).deviceName()).isNull();
    }

    private static Machine machine(String nickname, String displayName, String hostname) {
        Machine machine = new Machine();
        machine.setNickname(nickname);
        machine.setDisplayName(displayName);
        machine.setHostname(hostname);
        return machine;
    }
}
