package com.openframe.api.integration.support;

import com.netflix.graphql.dgs.springgraphql.autoconfig.DgsSpringGraphQLAutoConfiguration;
import com.openframe.api.config.DateScalarConfig;
import com.openframe.api.config.InstantScalarConfig;
import com.openframe.api.config.JsonScalarConfig;
import com.openframe.api.config.LongScalarConfig;
import com.openframe.api.datafetcher.DeviceDataFetcher;
import com.openframe.api.exception.GraphQLExceptionHandler;
import com.openframe.api.mapper.DeviceFilterOptionMapper;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.FleetVulnerabilityStatusService;
import com.openframe.api.service.NotificationRecipientResolver;
import com.openframe.api.service.TagService;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.processor.DeviceStatusProcessor;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.config.TenantIsolationAutoConfiguration;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.software.DeviceSoftwareConnectivitySync;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import org.mockito.Mockito;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoRepositoriesAutoConfiguration;
import org.springframework.boot.graphql.autoconfigure.GraphQlAutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.validation.autoconfigure.ValidationAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * The device read of the api service against a real MongoDB: the whole GraphQL schema of the module, the device
 * fetcher and service as they run, the tenant-aware Mongo template of tenant-isolation mode.
 *
 * <p>The OS-update classes are found by name ({@link OsUpdateComponentFilter}) under their flag, so the test fixes
 * the stored state and the GraphQL answer and not the classes in between. What the device fetcher needs and no OS
 * read touches is mocked; the cleanup of a deleted device is the real one.
 */
@SpringBootConfiguration
@ImportAutoConfiguration({
        GraphQlAutoConfiguration.class,
        DgsSpringGraphQLAutoConfiguration.class,
        RelayAutoConfiguration.class,
        ValidationAutoConfiguration.class,
        MongoAutoConfiguration.class,
        DataMongoAutoConfiguration.class,
        DataMongoRepositoriesAutoConfiguration.class,
        JacksonAutoConfiguration.class
})
@EnableMongoRepositories(
        basePackages = "com.openframe.data.repository",
        includeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = {
                ".*\\.MachineRepository",
                ".*\\.ScriptScheduleMachineAssignedRepository",
                ".*\\.DeviceOnlineDispatchRepository",
                ".*\\.DeviceSoftwareRepository",
                ".*OsUpdate.*",
                ".*\\.osupdate\\..*"
        }))
@ComponentScan(
        basePackages = {"com.openframe.api", "com.openframe.data"},
        useDefaultFilters = false,
        includeFilters = @ComponentScan.Filter(type = FilterType.CUSTOM, classes = OsUpdateComponentFilter.class))
@Import({
        DeviceDataFetcher.class,
        DeviceService.class,
        GraphQLExceptionHandler.class,
        InstantScalarConfig.class,
        DateScalarConfig.class,
        LongScalarConfig.class,
        JsonScalarConfig.class,
        ClientVersionThreshold.class,
        CustomMachineRepositoryImpl.class,
        MachineWriter.class,
        DeletedMachineCleanup.class,
        TenantIsolationAutoConfiguration.class
})
public class DeviceOsReadTestApplication {

    public static final String TENANT_ID = "tenant-a";

    @Bean
    TenantIdProvider tenantIdProvider() {
        return () -> TENANT_ID;
    }

    @Bean
    DeviceStatusProcessor deviceStatusProcessor() {
        return machine -> { /* no-op for tests */ };
    }

    @Bean
    SoftwareProjectionTrigger softwareProjectionTrigger() {
        return Mockito.mock(SoftwareProjectionTrigger.class);
    }

    @Bean
    DeviceSoftwareConnectivitySync deviceSoftwareConnectivitySync() {
        return Mockito.mock(DeviceSoftwareConnectivitySync.class);
    }

    @Bean
    TagRepository tagRepository() {
        return Mockito.mock(TagRepository.class);
    }

    @Bean
    TagAssignmentRepository tagAssignmentRepository() {
        return Mockito.mock(TagAssignmentRepository.class);
    }

    @Bean
    DeviceFilterOptionMapper deviceFilterOptionMapper() {
        return Mockito.mock(DeviceFilterOptionMapper.class);
    }

    @Bean
    DeviceFilterService deviceFilterService() {
        return Mockito.mock(DeviceFilterService.class);
    }

    @Bean
    TagService tagService() {
        return Mockito.mock(TagService.class);
    }

    @Bean
    FleetVulnerabilityStatusService fleetVulnerabilityStatusService() {
        return Mockito.mock(FleetVulnerabilityStatusService.class);
    }

    @Bean
    GraphQLDeviceMapper graphQLDeviceMapper() {
        return Mockito.mock(GraphQLDeviceMapper.class);
    }

    @Bean
    PackageManagerAvailability packageManagerAvailability() {
        return Mockito.mock(PackageManagerAvailability.class);
    }

    @Bean
    NotificationRecipientResolver notificationRecipientResolver() {
        return Mockito.mock(NotificationRecipientResolver.class);
    }
}
