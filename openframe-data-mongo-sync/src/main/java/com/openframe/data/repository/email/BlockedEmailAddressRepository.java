package com.openframe.data.repository.email;

import com.openframe.data.document.email.BlockedEmailAddress;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BlockedEmailAddressRepository extends MongoRepository<BlockedEmailAddress, String> {
}
