package com.openframe.management.integration.support;

import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.osupdate.CisaKevClient;
import com.openframe.management.osupdate.MsrcCvrfClient;
import com.openframe.management.osupdate.OsUpdateEnrichmentMetrics;
import com.openframe.management.osupdate.OsUpdateEnrichmentScheduler;
import com.openframe.management.osupdate.OsUpdateEnrichmentService;
import com.openframe.management.osupdate.WindowsOsUpdateEnricher;
import com.openframe.management.osupdate.parser.CisaKevCatalogParser;
import com.openframe.management.osupdate.parser.MsrcCvrfDocumentParser;
import com.openframe.management.osupdate.parser.MsrcWindowsBuildParser;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
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
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@ImportAutoConfiguration({
        MongoAutoConfiguration.class,
        DataMongoAutoConfiguration.class,
        DataMongoRepositoriesAutoConfiguration.class,
        JacksonAutoConfiguration.class
})
@EnableMongoRepositories(
        basePackages = "com.openframe.data.repository.rmm.osupdate",
        includeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = {
                ".*\\.OsUpdateRepository", ".*\\.OsVersionBuildRepository"}))
@Import({
        OsUpdateEnrichmentService.class,
        OsUpdateEnrichmentMetrics.class,
        OsUpdateEnrichmentScheduler.class,
        WindowsOsUpdateEnricher.class,
        MsrcCvrfClient.class,
        CisaKevClient.class,
        MsrcCvrfDocumentParser.class,
        MsrcWindowsBuildParser.class,
        CisaKevCatalogParser.class
})
public class OsUpdateEnrichmentTestApplication {

    public static final String TENANT_ID = "tenant-a";

    @Bean
    public TenantIdProvider tenantIdProvider() {
        return () -> TENANT_ID;
    }

    @Bean
    public MeterRegistry meterRegistry() {
        return new SimpleMeterRegistry();
    }
}
