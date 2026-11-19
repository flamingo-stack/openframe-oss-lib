package com.openframe.client.integration.support;

import com.openframe.client.listener.rmm.MachinePackageManagersListener;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachinePackageManagersService;
import com.openframe.client.service.rmm.PackageManagerBootstrapService;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import io.nats.client.Connection;
import io.nats.client.Nats;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoRepositoriesAutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * The OS-report path of the client service against a real NATS and a real MongoDB: the agent's report goes in over
 * JetStream, the stored state is read from Mongo.
 *
 * <p>The OS-update classes are found by name ({@link OsUpdateComponentFilter}) under their flag, as the service
 * finds them, so the test fixes the wire and the stored state and not the classes in between. The package-managers
 * pair is here as the harness check: the same route, already in production.
 */
@SpringBootConfiguration
@ImportAutoConfiguration({
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
        basePackages = {"com.openframe.client", "com.openframe.data"},
        useDefaultFilters = false,
        includeFilters = @ComponentScan.Filter(type = FilterType.CUSTOM, classes = OsUpdateComponentFilter.class))
@Import({
        ClientVersionThreshold.class,
        CustomMachineRepositoryImpl.class,
        MachineWriter.class,
        DeletedMachineCleanup.class,
        NatsTopicMachineIdExtractor.class,
        MachinePackageManagersListener.class,
        MachinePackageManagersService.class
})
public class OsReportIngestTestApplication {

    public static final String TENANT_ID = "tenant-a";

    @Bean(destroyMethod = "close")
    public Connection natsConnection(@Value("${nats.spring.server}") String server) throws Exception {
        return Nats.connect(server);
    }

    @Bean
    public TenantIdProvider tenantIdProvider() {
        return () -> TENANT_ID;
    }

    @Bean
    public PackageManagerProperties packageManagerProperties() {
        return new PackageManagerProperties();
    }

    @Bean
    public PackageManagerBootstrapService packageManagerBootstrapService() {
        return Mockito.mock(PackageManagerBootstrapService.class);
    }

    @Bean
    public SoftwareProjectionTrigger softwareProjectionTrigger() {
        return Mockito.mock(SoftwareProjectionTrigger.class);
    }

    @Bean
    public static PropertySourcesPlaceholderConfigurer propertySourcesPlaceholderConfigurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }
}
