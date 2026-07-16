package com.example.BrokerNCoordinator.Service.Interface;

import com.example.BrokerNCoordinator.DataModel.CustomerAccount;

import java.util.Date;

public interface ICustomerAccountService {
//    requestAccount (in accountId, out account)
//    createAccount (in cardId, in cardType, in expirationDate,out accountld)
//    updateAccount (in accountId, in cardId, in cardType, in expirationDate)

    public /*account*/ CustomerAccount requestAccount(Integer accountId);
    public /*accountld*/ Integer createAccount(String cardId, String cardType, Date expirationDate);
    public Void updateAccount (Integer accountId, String cardId, String cardType, Date expirationDate);
}
