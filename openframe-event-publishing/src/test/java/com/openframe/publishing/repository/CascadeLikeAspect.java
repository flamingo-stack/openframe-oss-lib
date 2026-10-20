package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.Widget;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

// Registered like saas-lib's TicketCascadeAspect: around save, it writes elsewhere and logs a failure instead of throwing it.
@Slf4j
@Aspect
@RequiredArgsConstructor
public class CascadeLikeAspect {

    static final String CASCADING_NAME = "cascading";
    static final String CASCADE_COLLECTION = "it_cascade";

    private final MongoTemplate mongoTemplate;
    private volatile boolean ranInTransaction;

    @Around("execution(* com.openframe.publishing.repository.WidgetRepository.save(..))")
    public Object aroundSave(ProceedingJoinPoint joinPoint) throws Throwable {
        Object saved = joinPoint.proceed();
        if (saved instanceof Widget widget && CASCADING_NAME.equals(widget.getName())) {
            ranInTransaction = TransactionSynchronizationManager.isActualTransactionActive();
            cascadeThatFails();
        }
        return saved;
    }

    boolean ranInTransaction() {
        return ranInTransaction;
    }

    private void cascadeThatFails() {
        Document duplicate = new Document("_id", "same");
        try {
            mongoTemplate.save(duplicate, CASCADE_COLLECTION);
            mongoTemplate.insert(duplicate, CASCADE_COLLECTION);
        } catch (DuplicateKeyException e) {
            log.warn("Cascade failed, logged and ignored: {}", e.getMessage());
        }
    }
}
