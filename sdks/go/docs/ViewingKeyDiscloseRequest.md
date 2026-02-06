# ViewingKeyDiscloseRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ViewingKey** | [**ViewingKey**](ViewingKey.md) |  | 
**TransactionData** | [**ViewingKeyDiscloseRequestTransactionData**](ViewingKeyDiscloseRequestTransactionData.md) |  | 

## Methods

### NewViewingKeyDiscloseRequest

`func NewViewingKeyDiscloseRequest(viewingKey ViewingKey, transactionData ViewingKeyDiscloseRequestTransactionData, ) *ViewingKeyDiscloseRequest`

NewViewingKeyDiscloseRequest instantiates a new ViewingKeyDiscloseRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewingKeyDiscloseRequestWithDefaults

`func NewViewingKeyDiscloseRequestWithDefaults() *ViewingKeyDiscloseRequest`

NewViewingKeyDiscloseRequestWithDefaults instantiates a new ViewingKeyDiscloseRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetViewingKey

`func (o *ViewingKeyDiscloseRequest) GetViewingKey() ViewingKey`

GetViewingKey returns the ViewingKey field if non-nil, zero value otherwise.

### GetViewingKeyOk

`func (o *ViewingKeyDiscloseRequest) GetViewingKeyOk() (*ViewingKey, bool)`

GetViewingKeyOk returns a tuple with the ViewingKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetViewingKey

`func (o *ViewingKeyDiscloseRequest) SetViewingKey(v ViewingKey)`

SetViewingKey sets ViewingKey field to given value.


### GetTransactionData

`func (o *ViewingKeyDiscloseRequest) GetTransactionData() ViewingKeyDiscloseRequestTransactionData`

GetTransactionData returns the TransactionData field if non-nil, zero value otherwise.

### GetTransactionDataOk

`func (o *ViewingKeyDiscloseRequest) GetTransactionDataOk() (*ViewingKeyDiscloseRequestTransactionData, bool)`

GetTransactionDataOk returns a tuple with the TransactionData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransactionData

`func (o *ViewingKeyDiscloseRequest) SetTransactionData(v ViewingKeyDiscloseRequestTransactionData)`

SetTransactionData sets TransactionData field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


