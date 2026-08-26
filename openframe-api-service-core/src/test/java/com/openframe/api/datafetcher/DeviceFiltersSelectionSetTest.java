package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterFacet;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.TagService;
import graphql.ExecutionResult;
import graphql.GraphQL;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import static com.openframe.api.dto.device.DeviceFilterFacet.DEVICE_TYPES;
import static com.openframe.api.dto.device.DeviceFilterFacet.FILTERED_COUNT;
import static com.openframe.api.dto.device.DeviceFilterFacet.ORGANIZATION_IDS;
import static com.openframe.api.dto.device.DeviceFilterFacet.OS_TYPES;
import static com.openframe.api.dto.device.DeviceFilterFacet.STATUSES;
import static com.openframe.api.dto.device.DeviceFilterFacet.TAG_KEYS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The narrowing in {@link DeviceDataFetcher#deviceFilters} rests entirely on
 * {@code DataFetchingFieldSelectionSet.contains(field)} answering correctly. If it under-reports,
 * a facet is silently skipped and the UI shows zeroes with no error anywhere — so this drives a
 * REAL graphql-java execution rather than a hand-built selection set, and covers the two shapes a
 * unit test would miss: fragments (which is how every Relay document is compiled) and aliases.
 */
@ExtendWith(MockitoExtension.class)
class DeviceFiltersSelectionSetTest {

    /**
     * Mirrors the {@code DeviceFilters} block of {@code schema/device.graphqls}, with the fields
     * made nullable so the stub resolver doesn't have to populate them.
     * {@link #everyFacetFieldIsRealInTheProductionSchema()} guards against drift.
     */
    private static final String SDL = """
            type Query { deviceFilters: DeviceFilters }
            type DeviceFilters {
                statuses: [DeviceFilterOption]
                deviceTypes: [DeviceFilterOption]
                osTypes: [DeviceFilterOption]
                organizationIds: [DeviceFilterOption]
                tagKeys: [TagFilterOption]
                filteredCount: Int
            }
            type DeviceFilterOption { value: String label: String count: Int }
            type TagFilterOption { key: String value: String count: Int }
            """;

    @Mock private DeviceService deviceService;
    @Mock private DeviceFilterService deviceFilterService;
    @Mock private TagService tagService;
    @Mock private GraphQLDeviceMapper mapper;

    @Captor private ArgumentCaptor<Set<DeviceFilterFacet>> facetsCaptor;

    private GraphQL graphQL;

    @BeforeEach
    void setUp() {
        DeviceDataFetcher dataFetcher = new DeviceDataFetcher(deviceService, deviceFilterService, tagService, mapper);

        TypeDefinitionRegistry registry = new SchemaParser().parse(SDL);
        RuntimeWiring wiring = RuntimeWiring.newRuntimeWiring()
                .type("Query", builder -> builder.dataFetcher("deviceFilters",
                        env -> dataFetcher.deviceFilters(null, new DgsDataFetchingEnvironment(env))))
                .build();
        GraphQLSchema schema = new SchemaGenerator().makeExecutableSchema(registry, wiring);
        graphQL = GraphQL.newGraphQL(schema).build();
    }

    /**
     * Stubbed here rather than in {@code setUp} so the schema-drift test, which never executes a
     * query, doesn't trip Mockito's strict unnecessary-stubbing check.
     */
    private Set<DeviceFilterFacet> facetsFor(String query) {
        when(deviceFilterService.getDeviceFilters(any(DeviceFilterCriteria.class), facetsCaptor.capture()))
                .thenReturn(CompletableFuture.completedFuture(DeviceFilters.builder().build()));
        when(mapper.toDeviceFilterCriteria(any())).thenReturn(DeviceFilterCriteria.builder().build());

        ExecutionResult result = graphQL.execute(query);
        assertThat(result.getErrors()).isEmpty();
        return facetsCaptor.getValue();
    }

    @Test
    void filteredCountOnly_narrowsToOneFacet() {
        // The onboarding auto-detect query. Used to cost six Pinot round trips for one integer.
        assertThat(facetsFor("{ deviceFilters { filteredCount } }")).containsExactly(FILTERED_COUNT);
    }

    @Test
    void dashboardCounterSelection_narrowsToTwoFacets() {
        assertThat(facetsFor("{ deviceFilters { statuses { value count } filteredCount } }"))
                .containsExactlyInAnyOrder(STATUSES, FILTERED_COUNT);
    }

    @Test
    void customersOverviewSelection_narrowsToOneFacet() {
        assertThat(facetsFor("{ deviceFilters { organizationIds { value count } } }"))
                .containsExactly(ORGANIZATION_IDS);
    }

    @Test
    void filterUiSelection_stillGetsEveryFacet() {
        assertThat(facetsFor("""
                { deviceFilters {
                    statuses { value count }
                    deviceTypes { value count }
                    osTypes { value count }
                    organizationIds { value count }
                    tagKeys { key value count }
                    filteredCount
                } }"""))
                .containsExactlyInAnyOrder(STATUSES, DEVICE_TYPES, OS_TYPES, ORGANIZATION_IDS, TAG_KEYS, FILTERED_COUNT);
    }

    @Test
    void fieldsInsideFragments_areDetected() {
        // Relay compiles its documents into fragment spreads, so a selection-set check that only
        // saw inline fields would silently drop every facet the device filter UI asks for.
        assertThat(facetsFor("""
                { deviceFilters { ...counts ... on DeviceFilters { organizationIds { value } } } }
                fragment counts on DeviceFilters { statuses { value } filteredCount }"""))
                .containsExactlyInAnyOrder(STATUSES, FILTERED_COUNT, ORGANIZATION_IDS);
    }

    @Test
    void aliasedFields_areDetectedByTheirRealName() {
        assertThat(facetsFor("{ deviceFilters { byStatus: statuses { value } total: filteredCount } }"))
                .containsExactlyInAnyOrder(STATUSES, FILTERED_COUNT);
    }

    @Test
    void everyFacetFieldIsRealInTheProductionSchema() throws Exception {
        String schema;
        try (InputStream in = getClass().getResourceAsStream("/schema/device.graphqls")) {
            assertThat(in).as("schema/device.graphqls on the test classpath").isNotNull();
            schema = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        String deviceFiltersType = schema.substring(schema.indexOf("type DeviceFilters {"));
        deviceFiltersType = deviceFiltersType.substring(0, deviceFiltersType.indexOf('}'));

        for (DeviceFilterFacet facet : DeviceFilterFacet.values()) {
            assertThat(deviceFiltersType)
                    .as("DeviceFilterFacet.%s maps to a field that must exist on type DeviceFilters", facet)
                    .contains(facet.graphQlField() + ":");
        }
    }
}
