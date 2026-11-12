package com.openframe.data.document.device;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MachineNameTest {

    @Test
    void theNickname_winsOverTheHostname() {
        // execution
        String name = MachineName.preferred("Reception desk", "DESKTOP-N7C8QD0");

        // verifications
        assertThat(name).isEqualTo("Reception desk");
    }

    @Test
    void aBlankOrMissingNickname_fallsBackToTheHostname() {
        // execution and verifications
        assertThat(MachineName.preferred(null, "DESKTOP-N7C8QD0")).isEqualTo("DESKTOP-N7C8QD0");
        assertThat(MachineName.preferred("  ", "DESKTOP-N7C8QD0")).isEqualTo("DESKTOP-N7C8QD0");
    }

    @Test
    void aMachine_usesTheSameRule() {
        // setup
        Machine machine = new Machine();
        machine.setHostname("DESKTOP-N7C8QD0");
        machine.setNickname("Reception desk");

        // execution and verifications
        assertThat(machine.preferredName()).isEqualTo("Reception desk");
    }
}
