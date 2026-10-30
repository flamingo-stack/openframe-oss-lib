package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryPayload;
import com.openframe.data.repository.delivery.MachineDeliveryPayloadRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryPayloadStoreTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String HASH = "abc123";
    private static final String ID = "tenant-1:TOOL_INSTALLATION:abc123";
    private static final DeliveryPayloadBody BODY = new DeliveryPayloadBody("{\"value\":\"fleetmdm-agent\"}", HASH);

    @Mock private MachineDeliveryPayloadRepository repository;
    @Mock private TenantIdProvider tenants;
    @Captor private ArgumentCaptor<MachineDeliveryPayload> documentCaptor;

    private DeliveryPayloadStore store;
    private Instant expiresAt;

    @BeforeEach
    void setUp() {
        expiresAt = Instant.now().plusSeconds(3600);
        store = new DeliveryPayloadStore(repository, tenants);
    }

    @Test
    void hold_newBody_savedUnderTheTenantsContentIdWithTheRowsExpiry() {
        // setup
        when(tenants.getTenantId()).thenReturn(TENANT_ID);
        when(repository.findHeldById(ID)).thenReturn(Optional.empty());

        // execution
        String id = store.hold(DeliveryType.TOOL_INSTALLATION, BODY, expiresAt);

        // verifications
        assertThat(id).isEqualTo(ID);
        verify(repository).save(documentCaptor.capture());
        MachineDeliveryPayload saved = documentCaptor.getValue();
        assertThat(saved.getId()).isEqualTo(ID);
        assertThat(saved.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(saved.getPayloadJson()).isEqualTo(BODY.json());
        assertThat(saved.getExpiresAt()).isEqualTo(expiresAt);
    }

    @Test
    void hold_bodyAlreadyHeldLonger_nothingWritten() {
        // setup
        when(tenants.getTenantId()).thenReturn(TENANT_ID);
        when(repository.findHeldById(ID)).thenReturn(Optional.of(held(expiresAt.plusSeconds(60))));

        // execution
        String id = store.hold(DeliveryType.TOOL_INSTALLATION, BODY, expiresAt);

        // verifications
        assertThat(id).isEqualTo(ID);
        verify(repository, never()).save(any());
    }

    @Test
    void hold_bodyHeldShorter_onlyItsExpiryMovesForward() {
        // setup
        when(tenants.getTenantId()).thenReturn(TENANT_ID);
        MachineDeliveryPayload earlier = held(expiresAt.minusSeconds(60));
        when(repository.findHeldById(ID)).thenReturn(Optional.of(earlier));

        // execution
        store.hold(DeliveryType.TOOL_INSTALLATION, BODY, expiresAt);

        // verifications
        verify(repository).save(documentCaptor.capture());
        MachineDeliveryPayload saved = documentCaptor.getValue();
        assertThat(saved).isSameAs(earlier);
        assertThat(saved.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(saved.getPayloadJson()).isEqualTo("stored before");
    }

    @Test
    void find_heldBody_itsJson_goneBody_empty() {
        // setup
        when(repository.findHeldById(ID)).thenReturn(Optional.of(held(expiresAt)));
        when(repository.findHeldById("gone")).thenReturn(Optional.empty());

        // execution + verifications
        assertThat(store.find(ID)).contains("stored before");
        assertThat(store.find("gone")).isEmpty();
    }

    private static MachineDeliveryPayload held(Instant expiresAt) {
        MachineDeliveryPayload document = new MachineDeliveryPayload();
        document.setId(ID);
        document.setType(DeliveryType.TOOL_INSTALLATION);
        document.setPayloadJson("stored before");
        document.setExpiresAt(expiresAt);
        return document;
    }
}
