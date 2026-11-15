package com.openframe.audit.targets;

import com.openframe.audit.targets.AuditTarget.Container;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.ticket.Ticket;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static com.openframe.audit.targets.AuditTarget.TENANT_ID_FIELD;
import static org.assertj.core.api.Assertions.assertThat;

class AuditTargetTest {

    private static final Ticket TICKET = Ticket.builder()
            .title("Printer offline")
            .organizationId("org-1")
            .deviceId("machine-1")
            .build();

    @Test
    void nameOf_document_returnsTheNameItsReaderTakes() {
        assertThat(tickets().nameOf(TICKET)).isEqualTo("Printer offline");
    }

    @Test
    void organizationIdOf_customerReaderDeclared_returnsTheCustomerItReads() {
        assertThat(tickets().withOrganizationId(Ticket::getOrganizationId).organizationIdOf(TICKET))
                .isEqualTo("org-1");
    }

    @Test
    void deviceIdOf_deviceReaderDeclared_returnsTheDeviceItReads() {
        assertThat(tickets().withDeviceId(Ticket::getDeviceId).deviceIdOf(TICKET)).isEqualTo("machine-1");
    }

    @ParameterizedTest
    @MethodSource("factoriesDeclaringOnlyAName")
    void ofAndEmbedded_onlyNameDeclared_readNoCustomerAndNoDevice(Supplier<AuditTarget<Ticket>> factory) {
        AuditTarget<Ticket> target = factory.get();

        assertThat(target.organizationIdOf(TICKET)).isNull();
        assertThat(target.deviceIdOf(TICKET)).isNull();
    }

    @Test
    void keyedByTenant_idFieldIsTheTenantId_returnsTrue() {
        assertThat(tickets().withIdField(TENANT_ID_FIELD).keyedByTenant()).isTrue();
    }

    @Test
    void keyedByTenant_keyedByItsMongoId_returnsFalse() {
        assertThat(tickets().keyedByTenant()).isFalse();
    }

    private static AuditTarget<Ticket> tickets() {
        return AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle);
    }

    private static Stream<Supplier<AuditTarget<Ticket>>> factoriesDeclaringOnlyAName() {
        return Stream.of(AuditTargetTest::tickets, () -> AuditTarget.embedded(AuditTargetType.TICKET, Ticket.class,
                new Container<>(Board.class, "tickets", Board::tickets, Ticket::getId), Ticket::getTitle));
    }

    private record Board(List<Ticket> tickets) {
    }
}
