package com.example.BrokerNCoordinator.Service.Interface;
import com.example.BrokerNCoordinator.DTO.Invoice;
import com.example.BrokerNCoordinator.DataModel.DeliveryOrder;
import com.example.BrokerNCoordinator.DataModel.Enum.OrderStatusType;

public interface IDeliveryOrderService {

    Integer store(DeliveryOrder order);

    DeliveryOrder select(Integer supplierId);

    OrderStatusType update(Integer orderId, DeliveryOrder order);

    OrderStatusType orderShipped(Integer orderId);

    OrderStatusType confirmPayment(Integer orderId, Double amount);

    DeliveryOrder read(Integer orderId);

    Invoice requestInvoice(Integer orderId);

    DeliveryOrder prepareToCommitOrder(Integer orderId);

    void commit(Integer orderId);

    void abort(Integer orderId);
}
