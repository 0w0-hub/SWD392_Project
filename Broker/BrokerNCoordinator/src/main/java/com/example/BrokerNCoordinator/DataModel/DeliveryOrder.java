package com.example.BrokerNCoordinator.DataModel;

import com.example.BrokerNCoordinator.DataModel.Enum.OrderStatusType;

import java.util.Date;
import java.util.List;

public class DeliveryOrder {
    public Integer orderId;
    public OrderStatusType orderStatus;
    public Integer accountId;
    public Double amountDue;
    public Integer authorizationId;
    public Integer supplierId;
    public Date creationDate;
    public Date plannedShipDate;
    public Date actualShipDate;
    public Date paymentDate;
    public List<Item> items;
}