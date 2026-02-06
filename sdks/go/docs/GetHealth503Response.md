# GetHealth503Response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Success** | **bool** |  | 
**Error** | [**GetHealth503ResponseError**](GetHealth503ResponseError.md) |  | 

## Methods

### NewGetHealth503Response

`func NewGetHealth503Response(success bool, error_ GetHealth503ResponseError, ) *GetHealth503Response`

NewGetHealth503Response instantiates a new GetHealth503Response object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGetHealth503ResponseWithDefaults

`func NewGetHealth503ResponseWithDefaults() *GetHealth503Response`

NewGetHealth503ResponseWithDefaults instantiates a new GetHealth503Response object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSuccess

`func (o *GetHealth503Response) GetSuccess() bool`

GetSuccess returns the Success field if non-nil, zero value otherwise.

### GetSuccessOk

`func (o *GetHealth503Response) GetSuccessOk() (*bool, bool)`

GetSuccessOk returns a tuple with the Success field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuccess

`func (o *GetHealth503Response) SetSuccess(v bool)`

SetSuccess sets Success field to given value.


### GetError

`func (o *GetHealth503Response) GetError() GetHealth503ResponseError`

GetError returns the Error field if non-nil, zero value otherwise.

### GetErrorOk

`func (o *GetHealth503Response) GetErrorOk() (*GetHealth503ResponseError, bool)`

GetErrorOk returns a tuple with the Error field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetError

`func (o *GetHealth503Response) SetError(v GetHealth503ResponseError)`

SetError sets Error field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


