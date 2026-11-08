package com.openframe.data.integration.repository.email;

import com.openframe.data.document.email.BlockedEmailAddress;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.BlockedEmailAddressIntegrationTestApplication;
import com.openframe.data.repository.email.BlockedEmailAddressRepository;
import com.openframe.data.repository.email.StoredBlockedEmailAddressSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = BlockedEmailAddressIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class BlockedEmailAddressRepositoryIT extends BaseMongoIntegrationTest {

    private static final String BLOCKED_ADDRESS = "spammer@gmail.com";
    private static final String OTHER_ADDRESS = "someone@gmail.com";
    private static final String TAGGED_BLOCKED_ADDRESS = "spammer+promo@gmail.com";
    private static final String FIRST_ADDRESS = "amy@example.com";
    private static final String LAST_ADDRESS = "zed@example.com";
    private static final String EMAIL_FIELD = "email";
    private static final String REASON = "spam submission";
    private static final String ADDED_BY = "it";

    @Autowired
    private BlockedEmailAddressRepository repository;

    @Autowired
    private StoredBlockedEmailAddressSource source;

    @BeforeEach
    void resetCollection() {
        repository.deleteAll();
    }

    @Test
    void isBlocked_storedAddress_true() {
        // setup
        BlockedEmailAddress blocked = address(BLOCKED_ADDRESS);
        repository.save(blocked);

        // execution
        boolean result = source.isBlocked(BLOCKED_ADDRESS);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isBlocked_otherAddressOnTheSameDomain_false() {
        // setup
        BlockedEmailAddress blocked = address(BLOCKED_ADDRESS);
        repository.save(blocked);

        // execution
        boolean result = source.isBlocked(OTHER_ADDRESS);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isBlocked_nonCanonicalSpellingOfAStoredAddress_false() {
        // setup
        BlockedEmailAddress blocked = address(BLOCKED_ADDRESS);
        repository.save(blocked);

        // execution
        boolean result = source.isBlocked(TAGGED_BLOCKED_ADDRESS);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void save_sameAddressTwice_oneEntryKept() {
        // setup
        BlockedEmailAddress first = address(BLOCKED_ADDRESS);
        BlockedEmailAddress second = address(BLOCKED_ADDRESS);
        repository.save(first);

        // execution
        repository.save(second);

        // verifications
        long stored = repository.count();
        assertThat(stored).isEqualTo(1);
    }

    @Test
    void findAll_sortedByEmail_alphabeticalOrder() {
        // setup
        BlockedEmailAddress last = address(LAST_ADDRESS);
        BlockedEmailAddress first = address(FIRST_ADDRESS);
        repository.save(last);
        repository.save(first);
        Sort byEmail = Sort.by(EMAIL_FIELD);

        // execution
        List<BlockedEmailAddress> result = repository.findAll(byEmail);

        // verifications
        assertThat(result)
                .extracting(BlockedEmailAddress::getEmail)
                .containsExactly(FIRST_ADDRESS, LAST_ADDRESS);
    }

    @Test
    void search_partOfTheAddressOrReasonInAnyCase_matchingPageOnly() {
        // setup
        repository.save(address(FIRST_ADDRESS));
        repository.save(address(LAST_ADDRESS));
        repository.save(address(BLOCKED_ADDRESS).toBuilder().reason("Link spam (contact form)").build());
        Pageable firstPage = PageRequest.of(0, 1, Sort.by(EMAIL_FIELD));

        // execution
        Page<BlockedEmailAddress> byAddress = repository
                .findByEmailContainingIgnoreCaseOrReasonContainingIgnoreCase("EXAMPLE", "EXAMPLE", firstPage);
        Page<BlockedEmailAddress> byReason = repository
                .findByEmailContainingIgnoreCaseOrReasonContainingIgnoreCase("(contact", "(contact", firstPage);

        // verifications
        assertThat(byAddress.getTotalElements()).isEqualTo(2);
        assertThat(byAddress.getContent()).extracting(BlockedEmailAddress::getEmail).containsExactly(FIRST_ADDRESS);
        assertThat(byReason.getContent()).extracting(BlockedEmailAddress::getEmail).containsExactly(BLOCKED_ADDRESS);
    }

    private static BlockedEmailAddress address(String email) {
        return BlockedEmailAddress.builder()
                .email(email)
                .reason(REASON)
                .addedBy(ADDED_BY)
                .build();
    }
}
