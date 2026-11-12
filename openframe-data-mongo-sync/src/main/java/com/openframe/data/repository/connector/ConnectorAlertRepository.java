package com.openframe.data.repository.connector;

import com.openframe.data.document.connector.ConnectorAlert;
import com.openframe.data.document.connector.ConnectorAlertType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ConnectorAlertRepository extends MongoRepository<ConnectorAlert, String> {

    List<ConnectorAlert> findByConnectorNameAndErrorTypeInAndResolvedFalse(String connectorName,
                                                                          Collection<ConnectorAlertType> errorTypes);

    boolean existsByConnectorNameAndErrorTypeInAndResolvedFalse(String connectorName,
                                                                Collection<ConnectorAlertType> errorTypes);

    boolean existsByConnectorNameAndErrorTypeAndResolvedFalse(String connectorName, ConnectorAlertType errorType);

    List<ConnectorAlert> findByResolvedFalse();
}
