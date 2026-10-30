package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "package_update_device_state")
@CompoundIndex(name = "tenant_request_machine", def = "{'tenantId': 1, 'requestId': 1, 'machineId': 1}", unique = true)
@CompoundIndex(name = "tenant_request", def = "{'tenantId': 1, 'requestId': 1}")
public class PackageUpdateDeviceState implements TenantScoped {

    @Id
    private String id;

    private String tenantId;
    private String requestId;
    private String machineId;

    private SoftwareActionStatus status;

    private PackageUpdateMode mode;

    private Instant deadlineAt;

    private String lastEventId;
    private Instant lastEventAt;

    private String state;

    private String waitingReason;
    private String waitingPhase;
    private Instant closesAt;
    private List<Holder> holders;

    private String doneResult;
    private Boolean rebootRequired;
    private Boolean relaunched;

    private String failedReason;
    private String failedMessage;
    private Long exitCode;

    private String installedVersion;
    private String availableVersion;

    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Holder {
        private String app;
        private String user;
    }
}
