package com.openframe.data.integration.repository.email;

import com.openframe.data.document.email.BlockedEmailDomain;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.BlockedEmailDomainIntegrationTestApplication;
import com.openframe.data.repository.email.BlockedEmailDomainRepository;
import com.openframe.data.repository.email.StoredBlockedEmailDomainSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = BlockedEmailDomainIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class BlockedEmailDomainRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private BlockedEmailDomainRepository repository;

    @Autowired
    private StoredBlockedEmailDomainSource source;

    @BeforeEach
    void resetCollection() {
        repository.deleteAll();
    }

    @Test
    @DisplayName("Given a stored domain, when the source is asked, then only that exact normalized domain is blocked")
    void isBlocked_matchesTheStoredDomainOnly() {
        repository.save(domain("rogue.example"));

        assertThat(source.isBlocked("rogue.example")).isTrue();
        assertThat(source.isBlocked("fresh.example")).isFalse();
        assertThat(source.isBlocked("sub.rogue.example")).isFalse();
    }

    @Test
    @DisplayName("Given a domain saved twice, when the collection is read, then it holds one entry, because the domain is the id")
    void save_sameDomainTwiceKeepsOneEntry() {
        repository.save(domain("rogue.example"));
        repository.save(domain("rogue.example"));

        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Given several domains, when they are listed by domain, then they come back alphabetically")
    void findAll_sortedByDomain() {
        repository.save(domain("zeta.example"));
        repository.save(domain("alpha.example"));

        assertThat(repository.findAll(Sort.by("domain")))
                .extracting(BlockedEmailDomain::getDomain)
                .containsExactly("alpha.example", "zeta.example");
    }

    private static BlockedEmailDomain domain(String name) {
        return BlockedEmailDomain.builder().domain(name).reason("abuse signup").addedBy("it").build();
    }
}
