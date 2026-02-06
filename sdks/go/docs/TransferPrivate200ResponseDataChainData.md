# TransferPrivate200ResponseDataChainData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Type** | **string** |  | 
**Transaction** | **string** | Base64-encoded unsigned transaction | 
**Mint** | Pointer to **string** |  | [optional] 
**To** | **string** | Recipient or token contract address | 
**Value** | **string** | Native currency amount (wei) | 
**Data** | **string** | Calldata (0x for native, ABI-encoded for ERC20) | 
**ChainId** | **int32** |  | 
**TokenContract** | Pointer to **string** |  | [optional] 
**ReceiverId** | **string** |  | 
**Actions** | [**[]NearTransferDataActionsInner**](NearTransferDataActionsInner.md) |  | 

## Methods

### NewTransferPrivate200ResponseDataChainData

`func NewTransferPrivate200ResponseDataChainData(type_ string, transaction string, to string, value string, data string, chainId int32, receiverId string, actions []NearTransferDataActionsInner, ) *TransferPrivate200ResponseDataChainData`

NewTransferPrivate200ResponseDataChainData instantiates a new TransferPrivate200ResponseDataChainData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferPrivate200ResponseDataChainDataWithDefaults

`func NewTransferPrivate200ResponseDataChainDataWithDefaults() *TransferPrivate200ResponseDataChainData`

NewTransferPrivate200ResponseDataChainDataWithDefaults instantiates a new TransferPrivate200ResponseDataChainData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetType

`func (o *TransferPrivate200ResponseDataChainData) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *TransferPrivate200ResponseDataChainData) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *TransferPrivate200ResponseDataChainData) SetType(v string)`

SetType sets Type field to given value.


### GetTransaction

`func (o *TransferPrivate200ResponseDataChainData) GetTransaction() string`

GetTransaction returns the Transaction field if non-nil, zero value otherwise.

### GetTransactionOk

`func (o *TransferPrivate200ResponseDataChainData) GetTransactionOk() (*string, bool)`

GetTransactionOk returns a tuple with the Transaction field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransaction

`func (o *TransferPrivate200ResponseDataChainData) SetTransaction(v string)`

SetTransaction sets Transaction field to given value.


### GetMint

`func (o *TransferPrivate200ResponseDataChainData) GetMint() string`

GetMint returns the Mint field if non-nil, zero value otherwise.

### GetMintOk

`func (o *TransferPrivate200ResponseDataChainData) GetMintOk() (*string, bool)`

GetMintOk returns a tuple with the Mint field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMint

`func (o *TransferPrivate200ResponseDataChainData) SetMint(v string)`

SetMint sets Mint field to given value.

### HasMint

`func (o *TransferPrivate200ResponseDataChainData) HasMint() bool`

HasMint returns a boolean if a field has been set.

### GetTo

`func (o *TransferPrivate200ResponseDataChainData) GetTo() string`

GetTo returns the To field if non-nil, zero value otherwise.

### GetToOk

`func (o *TransferPrivate200ResponseDataChainData) GetToOk() (*string, bool)`

GetToOk returns a tuple with the To field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTo

`func (o *TransferPrivate200ResponseDataChainData) SetTo(v string)`

SetTo sets To field to given value.


### GetValue

`func (o *TransferPrivate200ResponseDataChainData) GetValue() string`

GetValue returns the Value field if non-nil, zero value otherwise.

### GetValueOk

`func (o *TransferPrivate200ResponseDataChainData) GetValueOk() (*string, bool)`

GetValueOk returns a tuple with the Value field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetValue

`func (o *TransferPrivate200ResponseDataChainData) SetValue(v string)`

SetValue sets Value field to given value.


### GetData

`func (o *TransferPrivate200ResponseDataChainData) GetData() string`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *TransferPrivate200ResponseDataChainData) GetDataOk() (*string, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *TransferPrivate200ResponseDataChainData) SetData(v string)`

SetData sets Data field to given value.


### GetChainId

`func (o *TransferPrivate200ResponseDataChainData) GetChainId() int32`

GetChainId returns the ChainId field if non-nil, zero value otherwise.

### GetChainIdOk

`func (o *TransferPrivate200ResponseDataChainData) GetChainIdOk() (*int32, bool)`

GetChainIdOk returns a tuple with the ChainId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChainId

`func (o *TransferPrivate200ResponseDataChainData) SetChainId(v int32)`

SetChainId sets ChainId field to given value.


### GetTokenContract

`func (o *TransferPrivate200ResponseDataChainData) GetTokenContract() string`

GetTokenContract returns the TokenContract field if non-nil, zero value otherwise.

### GetTokenContractOk

`func (o *TransferPrivate200ResponseDataChainData) GetTokenContractOk() (*string, bool)`

GetTokenContractOk returns a tuple with the TokenContract field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTokenContract

`func (o *TransferPrivate200ResponseDataChainData) SetTokenContract(v string)`

SetTokenContract sets TokenContract field to given value.

### HasTokenContract

`func (o *TransferPrivate200ResponseDataChainData) HasTokenContract() bool`

HasTokenContract returns a boolean if a field has been set.

### GetReceiverId

`func (o *TransferPrivate200ResponseDataChainData) GetReceiverId() string`

GetReceiverId returns the ReceiverId field if non-nil, zero value otherwise.

### GetReceiverIdOk

`func (o *TransferPrivate200ResponseDataChainData) GetReceiverIdOk() (*string, bool)`

GetReceiverIdOk returns a tuple with the ReceiverId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReceiverId

`func (o *TransferPrivate200ResponseDataChainData) SetReceiverId(v string)`

SetReceiverId sets ReceiverId field to given value.


### GetActions

`func (o *TransferPrivate200ResponseDataChainData) GetActions() []NearTransferDataActionsInner`

GetActions returns the Actions field if non-nil, zero value otherwise.

### GetActionsOk

`func (o *TransferPrivate200ResponseDataChainData) GetActionsOk() (*[]NearTransferDataActionsInner, bool)`

GetActionsOk returns a tuple with the Actions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActions

`func (o *TransferPrivate200ResponseDataChainData) SetActions(v []NearTransferDataActionsInner)`

SetActions sets Actions field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


