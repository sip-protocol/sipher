# TransferPrivate422Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Success** | Pointer to **bool** |  | [optional] 
**Error** | Pointer to [**TransferPrivate422ResponseError**](TransferPrivate422ResponseError.md) |  | [optional] 

## Methods

### NewTransferPrivate422Response

`func NewTransferPrivate422Response() *TransferPrivate422Response`

NewTransferPrivate422Response instantiates a new TransferPrivate422Response object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewTransferPrivate422ResponseWithDefaults

`func NewTransferPrivate422ResponseWithDefaults() *TransferPrivate422Response`

NewTransferPrivate422ResponseWithDefaults instantiates a new TransferPrivate422Response object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSuccess

`func (o *TransferPrivate422Response) GetSuccess() bool`

GetSuccess returns the Success field if non-nil, zero value otherwise.

### GetSuccessOk

`func (o *TransferPrivate422Response) GetSuccessOk() (*bool, bool)`

GetSuccessOk returns a tuple with the Success field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuccess

`func (o *TransferPrivate422Response) SetSuccess(v bool)`

SetSuccess sets Success field to given value.

### HasSuccess

`func (o *TransferPrivate422Response) HasSuccess() bool`

HasSuccess returns a boolean if a field has been set.

### GetError

`func (o *TransferPrivate422Response) GetError() TransferPrivate422ResponseError`

GetError returns the Error field if non-nil, zero value otherwise.

### GetErrorOk

`func (o *TransferPrivate422Response) GetErrorOk() (*TransferPrivate422ResponseError, bool)`

GetErrorOk returns a tuple with the Error field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetError

`func (o *TransferPrivate422Response) SetError(v TransferPrivate422ResponseError)`

SetError sets Error field to given value.

### HasError

`func (o *TransferPrivate422Response) HasError() bool`

HasError returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


