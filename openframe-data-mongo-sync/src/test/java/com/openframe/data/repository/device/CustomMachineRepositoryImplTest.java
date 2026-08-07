package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class CustomMachineRepositoryImplTest {

    private final CustomMachineRepositoryImpl repo = new CustomMachineRepositoryImpl(mock(TenantAwareMongoTemplate.class));

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

    private static boolean mentionsField(Object node, String field) {
        if (node instanceof Document doc) {
            return doc.containsKey(field) || doc.values().stream().anyMatch(v -> mentionsField(v, field));
        }
        if (node instanceof List<?> list) {
            return list.stream().anyMatch(v -> mentionsField(v, field));
        }
        return false;
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

    private static MachineQueryFilter allDimensionsFilter() {
        MachineQueryFilter filter = new MachineQueryFilter();
        filter.setStatuses(List.of("ONLINE"));
        filter.setDeviceTypes(List.of("WORKSTATION"));
        filter.setOsTypes(List.of("macos"));
        filter.setOrganizationIds(List.of("org-1"));
        return filter;
    }

    @Test
    @DisplayName("facet(status): the status arm self-excludes — the $in is gone and the DELETED guard returns, so the status dropdown still offers every non-deleted status; other arms stay")
    void statusFacetSelfExcludesAndKeepsOtherArms() {
        Document q = repo.buildDeviceQuery(allDimensionsFilter(), null, "status").getQueryObject();

        Document status = statusClause(q);
        assertThat(status).isNotNull();
        assertThat(status).containsKey("$ne");          // guard re-applied (no caller status constraint)
        assertThat(status).doesNotContainKey("$in");    // caller's status arm dropped
        assertThat(mentionsField(q, "type")).isTrue();
        assertThat(mentionsField(q, "osType")).isTrue();
        assertThat(mentionsField(q, "organizationId")).isTrue();
    }

    @Test
    @DisplayName("facet(type): the deviceType arm self-excludes; status $in and the other arms remain")
    void typeFacetSelfExcludes() {
        Document q = repo.buildDeviceQuery(allDimensionsFilter(), null, "type").getQueryObject();

        assertThat(mentionsField(q, "type")).isFalse();
        assertThat(statusClause(q)).containsKey("$in");
        assertThat(mentionsField(q, "osType")).isTrue();
        assertThat(mentionsField(q, "organizationId")).isTrue();
    }

    @Test
    @DisplayName("facet(osType): the osType arm self-excludes; the other arms remain")
    void osTypeFacetSelfExcludes() {
        Document q = repo.buildDeviceQuery(allDimensionsFilter(), null, "osType").getQueryObject();

        assertThat(mentionsField(q, "osType")).isFalse();
        assertThat(statusClause(q)).containsKey("$in");
        assertThat(mentionsField(q, "type")).isTrue();
        assertThat(mentionsField(q, "organizationId")).isTrue();
    }

    @Test
    @DisplayName("facet(organizationId): the organization arm self-excludes; the other arms remain")
    void organizationFacetSelfExcludes() {
        Document q = repo.buildDeviceQuery(allDimensionsFilter(), null, "organizationId").getQueryObject();

        assertThat(mentionsField(q, "organizationId")).isFalse();
        assertThat(statusClause(q)).containsKey("$in");
        assertThat(mentionsField(q, "type")).isTrue();
        assertThat(mentionsField(q, "osType")).isTrue();
    }

    @Test
    @DisplayName("facet: the picker's scope (restrictToMachineIds) is NEVER dropped — it defines the set, not a facet dimension")
    void facetNeverDropsScopeRestriction() {
        MachineQueryFilter filter = allDimensionsFilter();
        filter.setRestrictToMachineIds(List.of("m1", "m2"));

        Document q = repo.buildDeviceQuery(filter, null, "status").getQueryObject();

        assertThat(mentionsField(q, "machineId")).isTrue();
    }
}
