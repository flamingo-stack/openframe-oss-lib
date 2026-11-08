package com.openframe.data.integration.repository.email;

import com.openframe.data.document.email.BlockedEmailAddress;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.BlockedEmailAddressIntegrationTestApplication;
import com.openframe.data.repository.email.BlockedEmailAddressRepository;
import com.openframe.data.repository.email.StoredBlockedEmailAddressSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = BlockedEmailAddressIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class BlockedEmailAddressRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private BlockedEmailAddressRepository repository;

    @Autowired
    private StoredBlockedEmailAddressSource source;

    @BeforeEach
    void resetCollection() {
        repository.deleteAll();
    }

    @Test
    @DisplayName("Given a stored address, when the source is asked, then only that exact normalized address is blocked")
    void isBlocked_matchesTheStoredAddressOnly() {
        repository.save(address("spammer@gmail.com"));

        assertThat(source.isBlocked("spammer@gmail.com")).isTrue();
        assertThat(source.isBlocked("someone@gmail.com")).isFalse();
        // the source is an exact lookup: EmailDomainPolicy folds a +tag (and Gmail dots) before it asks
        assertThat(source.isBlocked("spammer+promo@gmail.com")).isFalse();
    }

    @Test
    @DisplayName("Given an address saved twice, when the collection is read, then it holds one entry, because the address is the id")
    void save_sameAddressTwiceKeepsOneEntry() {
        repository.save(address("spammer@gmail.com"));
        repository.save(address("spammer@gmail.com"));

        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("Given several addresses, when they are listed by address, then they come back alphabetically")
    void findAll_sortedByEmail() {
        repository.save(address("zed@example.com"));
        repository.save(address("amy@example.com"));

        assertThat(repository.findAll(Sort.by("email")))
                .extracting(BlockedEmailAddress::getEmail)
                .containsExactly("amy@example.com", "zed@example.com");
    }

    private static BlockedEmailAddress address(String email) {
        return BlockedEmailAddress.builder().email(email).reason("spam submission").addedBy("it").build();
    }
}
