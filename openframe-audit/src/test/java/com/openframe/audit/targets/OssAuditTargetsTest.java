package com.openframe.audit.targets;

import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;

import static com.openframe.data.document.audit.AuditTargetType.DEVICE;
import static com.openframe.data.document.audit.AuditTargetType.USER;
import static org.assertj.core.api.Assertions.assertThat;

class OssAuditTargetsTest {

    private final OssAuditTargets provider = new OssAuditTargets();

    @Test
    void targets_deviceWithANickname_isNamedByTheNickname() {
        Machine machine = machine("Reception PC", "DESKTOP-4F2K");

        assertThat(targetOf(DEVICE).nameOf(machine)).isEqualTo("Reception PC");
    }

    @Test
    void targets_deviceWithABlankNickname_isNamedByTheHostname() {
        Machine machine = machine(" ", "DESKTOP-4F2K");

        assertThat(targetOf(DEVICE).nameOf(machine)).isEqualTo("DESKTOP-4F2K");
    }

    @Test
    void targets_userWithAName_isNamedByTheName() {
        User user = User.builder().firstName("Anna").lastName("Kowalski").email("anna@acme.com").build();

        assertThat(targetOf(USER).nameOf(user)).isEqualTo("Anna Kowalski");
    }

    @Test
    void targets_userWithoutAName_isNamedByTheEmail() {
        User user = User.builder().email("anna@acme.com").build();

        assertThat(targetOf(USER).nameOf(user)).isEqualTo("anna@acme.com");
    }

    private AuditTarget<?> targetOf(AuditTargetType type) {
        return provider.targets().stream()
                .filter(target -> target.type() == type)
                .findFirst()
                .orElseThrow();
    }

    private static Machine machine(String nickname, String hostname) {
        Machine machine = new Machine();
        machine.setNickname(nickname);
        machine.setHostname(hostname);
        return machine;
    }
}
