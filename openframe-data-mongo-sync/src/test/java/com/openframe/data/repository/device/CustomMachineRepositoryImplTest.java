package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomMachineRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";

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

    private static Pattern fieldPattern(Object node, String field) {
        if (node instanceof Document doc) {
            if (doc.get(field) instanceof Pattern pattern) {
                return pattern;
            }
            return doc.values().stream()
                    .map(v -> fieldPattern(v, field))
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        if (node instanceof List<?> list) {
            return list.stream()
                    .map(v -> fieldPattern(v, field))
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private static Document runNicknameCursor(String cursorNickname, boolean asc) {
        MongoTemplate tpl = mock(MongoTemplate.class);
        CustomMachineRepositoryImpl r = new CustomMachineRepositoryImpl(tpl);
        Machine cursorDoc = new Machine();
        cursorDoc.setNickname(cursorNickname);
        when(tpl.findById(any(ObjectId.class), eq(Machine.class))).thenReturn(cursorDoc);
        when(tpl.find(any(Query.class), eq(Machine.class))).thenReturn(List.of());
        r.findMachinesWithCursor(TENANT_ID, null, null, new ObjectId().toHexString(), 10,
                "nickname", asc ? "ASC" : "DESC");
        ArgumentCaptor<Query> qc = ArgumentCaptor.forClass(Query.class);
        verify(tpl).find(qc.capture(), eq(Machine.class));
        return qc.getValue().getQueryObject();
    }

    private static boolean nickHasOp(Document q, String op) {
        return anyNode(q, d -> d.get("nickname") instanceof Document nn && nn.containsKey(op));
    }

    private static boolean nickIsNull(Document q) {
        return anyNode(q, d -> d.containsKey("nickname") && d.get("nickname") == null);
    }

    private static boolean anyNode(Object node, java.util.function.Predicate<Document> pred) {
        if (node instanceof Document d) {
            return pred.test(d) || d.values().stream().anyMatch(v -> anyNode(v, pred));
        }
        if (node instanceof List<?> list) {
            return list.stream().anyMatch(v -> anyNode(v, pred));
        }
        return false;
    }

    // ---- cursor null-key boundary regression (nickname is nullable + sortable) ----

    @Test
    @DisplayName("buildDeviceQuery: search input is regex-quoted — metacharacters match literally and hostile patterns like (a+)+$ never reach the regex engine unescaped")
    void searchInputIsRegexQuoted() {
        String hostile = "(a+)+$";

        Document q = repo.buildDeviceQuery(null, hostile).getQueryObject();

        for (String field : List.of("hostname", "displayName", "ip", "serialNumber", "manufacturer", "model")) {
            Pattern pattern = fieldPattern(q, field);
            assertThat(pattern).as(field).isNotNull();
            assertThat(pattern.pattern()).as(field).isEqualTo(Pattern.quote(hostile));
        }
    }

    @Test
    @DisplayName("buildDeviceQuery: a search term matches nickname (alongside hostname and displayName)")
    void searchMatchesNickname() {
        Document q = repo.buildDeviceQuery(null, "reception").getQueryObject();

        assertThat(mentionsField(q, "nickname")).isTrue();
        assertThat(mentionsField(q, "hostname")).isTrue();
        assertThat(mentionsField(q, "displayName")).isTrue();
    }

    @Test
    @DisplayName("no search term → the name $or (and nickname) is absent")
    void noSearchNoNicknameClause() {
        Document q = repo.buildDeviceQuery(null, null).getQueryObject();

        assertThat(mentionsField(q, "nickname")).isFalse();
    }

    @Test
    @DisplayName("nickname is a sortable field")
    void nicknameIsSortable() {
        assertThat(repo.isSortableField("nickname")).isTrue();
    }

    @Test
    @DisplayName("cursor ASC at a null-nickname boundary: keeps every non-null row (regression: they were dropped)")
    void ascNullNicknameCursor_keepsNonNullRows() {
        Document q = runNicknameCursor(null, true);
        assertThat(nickHasOp(q, "$ne")).as("all-non-null arm present").isTrue();
        assertThat(nickIsNull(q)).as("remaining-null-rows arm present").isTrue();
    }

    @Test
    @DisplayName("cursor DESC at a null-nickname boundary: only remaining null rows, no non-null re-included")
    void descNullNicknameCursor_onlyNullRows() {
        Document q = runNicknameCursor(null, false);
        assertThat(nickIsNull(q)).isTrue();
        assertThat(nickHasOp(q, "$ne")).isFalse();
    }

    @Test
    @DisplayName("cursor DESC at a non-null nickname: trailing null rows are included (regression: they were dropped)")
    void descNonNullNicknameCursor_includesTrailingNulls() {
        Document q = runNicknameCursor("m-nick", false);
        assertThat(nickHasOp(q, "$lt")).isTrue();
        assertThat(nickIsNull(q)).as("trailing null arm present").isTrue();
    }

    @Test
    @DisplayName("cursor ASC at a non-null nickname: pure keyset — nulls already emitted, not re-included")
    void ascNonNullNicknameCursor_noNullArm() {
        Document q = runNicknameCursor("m-nick", true);
        assertThat(nickHasOp(q, "$gt")).isTrue();
        assertThat(nickIsNull(q)).isFalse();
        assertThat(nickHasOp(q, "$ne")).isFalse();
    }
}
