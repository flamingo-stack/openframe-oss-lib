package com.openframe.data.repository.email;

import com.openframe.data.document.email.BlockedEmailAddress;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** The email address block list kept in the database, read by {@link StoredBlockedEmailAddressSource}. */
@Repository
public interface BlockedEmailAddressRepository extends MongoRepository<BlockedEmailAddress, String> {

    List<BlockedEmailAddress> findAll(Sort sort);
}
