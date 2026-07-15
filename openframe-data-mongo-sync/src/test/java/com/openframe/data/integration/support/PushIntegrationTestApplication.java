package com.openframe.data.integration.support;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * The IT builds the TenantAwareMongoTemplate and the repository impl by hand and creates the index
 * itself, so no @EnableMongoRepositories / @Import is needed — @EnableAutoConfiguration just supplies
 * the MongoDatabaseFactory + MappingMongoConverter. Auditing stays off: registerToken sets the
 * timestamps itself.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
public class PushIntegrationTestApplication {
}
