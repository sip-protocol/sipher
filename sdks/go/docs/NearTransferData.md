# NearTransferData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Type** | **string** |  | 
**ReceiverId** | **string** |  | 
**Actions** | [**[]NearTransferDataActionsInner**](NearTransferDataActionsInner.md) |  | 
**TokenContract** | Pointer to **string** |  | [optional] 

## Methods

### NewNearTransferData

`func NewNearTransferData(type_ string, receiverId string, actions []NearTransferDataActionsInner, ) *NearTransferData`

NewNearTransferData instantiates a new NearTransferData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewNearTransferDataWithDefaults

`func NewNearTransferDataWithDefaults() *NearTransferData`

NewNearTransferDataWithDefaults instantiates a new NearTransferData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetType

`func (o *NearTransferData) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *NearTransferData) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *NearTransferData) SetType(v string)`

SetType sets Type field to given value.


### GetReceiverId

`func (o *NearTransferData) GetReceiverId() string`

GetReceiverId returns the ReceiverId field if non-nil, zero value otherwise.

### GetReceiverIdOk

`func (o *NearTransferData) GetReceiverIdOk() (*string, bool)`

GetReceiverIdOk returns a tuple with the ReceiverId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReceiverId

`func (o *NearTransferData) SetReceiverId(v string)`

SetReceiverId sets ReceiverId field to given value.


### GetActions

`func (o *NearTransferData) GetActions() []NearTransferDataActionsInner`

GetActions returns the Actions field if non-nil, zero value otherwise.

### GetActionsOk

`func (o *NearTransferData) GetActionsOk() (*[]NearTransferDataActionsInner, bool)`

GetActionsOk returns a tuple with the Actions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActions

`func (o *NearTransferData) SetActions(v []NearTransferDataActionsInner)`

SetActions sets Actions field to given value.


### GetTokenContract

`func (o *NearTransferData) GetTokenContract() string`

GetTokenContract returns the TokenContract field if non-nil, zero value otherwise.

### GetTokenContractOk

`func (o *NearTransferData) GetTokenContractOk() (*string, bool)`

GetTokenContractOk returns a tuple with the TokenContract field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTokenContract

`func (o *NearTransferData) SetTokenContract(v string)`

SetTokenContract sets TokenContract field to given value.

### HasTokenContract

`func (o *NearTransferData) HasTokenContract() bool`

HasTokenContract returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


