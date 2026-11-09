package com.openframe.data.integration.support;

import com.openframe.data.repository.email.BlockedEmailAddressRepository;
import com.openframe.data.repository.email.StoredBlockedEmailAddressSource;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = BlockedEmailAddressRepository.class)
@Import(StoredBlockedEmailAddressSource.class)
public class BlockedEmailAddressIntegrationTestApplication {
}
