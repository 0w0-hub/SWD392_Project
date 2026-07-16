package com.example.BrokerNCoordinator.Controller;

import com.example.BrokerNCoordinator.DTO.InventoryStatus;
import com.example.BrokerNCoordinator.DataModel.DeliveryOrder;
import com.example.BrokerNCoordinator.DataModel.Item;
import com.example.BrokerNCoordinator.Service.Interface.IDeliveryOrderService;
import com.example.BrokerNCoordinator.Service.Interface.IInventoryService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/suppliers")
public class SupplierCoordinator {
    private final IDeliveryOrderService deliveryOrderService;
    private final IInventoryService inventoryService;


    public SupplierCoordinator(IDeliveryOrderService deliveryOrderService, IInventoryService inventoryService) {
        this.deliveryOrderService = deliveryOrderService;
        this.inventoryService = inventoryService;
    }

//    public Object process(/*session*/ int supplierId){
//        DeliveryOrder order = deliveryOrderService.select(supplierId);
//        boolean isValid = true;
//        for(Item i : order.items){
//            InventoryStatus detail = inventoryService.checkInventory(i.itemId);
//            //Demo
//            if(detail.quantityAfterShipped < 0){
//                isValid = false;
//                break;
//            }
//        }
//        if(isValid){
//
//        }
//    }
}
