package com.openframe.client.integration.support;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.metrics.OsUpdateEnrichmentMetrics;
import com.openframe.client.scheduler.OsUpdateEnrichmentScheduler;
import com.openframe.client.service.rmm.osupdate.OsUpdateClassifier;
import com.openframe.client.service.rmm.osupdate.OsUpdateService;
import com.openframe.client.service.rmm.osupdate.StoredOsUpdateRefresher;
import com.openframe.client.service.rmm.osupdate.enrichment.CisaKevClient;
import com.openframe.client.service.rmm.osupdate.enrichment.MsrcCvrfClient;
import com.openframe.client.service.rmm.osupdate.enrichment.WindowsOsUpdateEnricher;
import com.openframe.client.service.rmm.osupdate.enrichment.parser.CisaKevCatalogParser;
import com.openframe.client.service.rmm.osupdate.enrichment.parser.MsrcCvrfDocumentParser;
import com.openframe.data.service.TenantIdProvider;
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
        includeFilters = @ComponentScan.Filter(type = FilterType.REGEX, pattern = ".*\\.OsUpdateRepository"))
@Import({
        OsUpdateService.class,
        OsUpdateClassifier.class,
        StoredOsUpdateRefresher.class,
        DeviceOsReportMetrics.class,
        OsUpdateEnrichmentMetrics.class,
        OsUpdateEnrichmentScheduler.class,
        WindowsOsUpdateEnricher.class,
        MsrcCvrfClient.class,
        CisaKevClient.class,
        MsrcCvrfDocumentParser.class,
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
