package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class CustomMachineRepositoryImplTest {

    private final CustomMachineRepositoryImpl repo =
            new CustomMachineRepositoryImpl(mock(MongoTemplate.class));

    private static Document statusClause(Document queryObject) {
        @SuppressWarnings("unchecked")
        List<Document> and = (List<Document>) queryObject.get("$and");
        if (and == null) {
            return null;
        }
        return and.stream()
                .filter(d -> d.containsKey("status"))
                .findFirst()
                .map(d -> (Document) d.get("status"))
                .orElse(null);
    }

    @Test
    @DisplayName("buildDeviceQuery: no filter → default guard status $ne DELETED — every caller inherits this without opting in")
    void defaultGuardExcludesDeleted() {
        Document q = repo.buildDeviceQuery(null, null).getQueryObject();

        Document status = statusClause(q);
        assertThat(status).isNotNull();
        assertThat(status.get("$ne")).isEqualTo(DeviceStatus.DELETED);
    }

    @Test
    @DisplayName("buildDeviceQuery: empty filter (no fields set) still gets the default guard")
    void emptyFilterStillGetsGuard() {
        Document q = repo.buildDeviceQuery(new MachineQueryFilter(), null).getQueryObject();

        Document status = statusClause(q);
        assertThat(status).isNotNull();
        assertThat(status.get("$ne")).isEqualTo(DeviceStatus.DELETED);
    }

    @Test
    @DisplayName("buildDeviceQuery: explicit statuses filter OPTS OUT of the default guard — caller's $in wins, no stacking with $ne")
    void explicitStatusesFilterSkipsDefaultGuard() {
        MachineQueryFilter filter = new MachineQueryFilter();
        filter.setStatuses(List.of("DELETED"));

        Document q = repo.buildDeviceQuery(filter, null).getQueryObject();

        Document status = statusClause(q);
        assertThat(status).isNotNull();
        assertThat(status).containsKey("$in");
        assertThat(status).doesNotContainKey("$ne");   // no stacking
    }

    @Test
    @DisplayName("buildDeviceQuery: explicit non-DELETED status filter (e.g. [ONLINE]) still opts out of the default guard — caller's intent is authoritative")
    void explicitNonDeletedStatusFilterSkipsDefaultGuard() {
        MachineQueryFilter filter = new MachineQueryFilter();
        filter.setStatuses(List.of("ONLINE"));

        Document q = repo.buildDeviceQuery(filter, null).getQueryObject();

        Document status = statusClause(q);
        assertThat(status).isNotNull();
        assertThat(status).containsKey("$in");
        assertThat(status).doesNotContainKey("$ne");
    }
}
