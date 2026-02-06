# GetHealth503ResponseError

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Code** | **string** |  | 
**Message** | **string** |  | 
**Details** | Pointer to **interface{}** |  | [optional] 

## Methods

### NewGetHealth503ResponseError

`func NewGetHealth503ResponseError(code string, message string, ) *GetHealth503ResponseError`

NewGetHealth503ResponseError instantiates a new GetHealth503ResponseError object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGetHealth503ResponseErrorWithDefaults

`func NewGetHealth503ResponseErrorWithDefaults() *GetHealth503ResponseError`

NewGetHealth503ResponseErrorWithDefaults instantiates a new GetHealth503ResponseError object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCode

`func (o *GetHealth503ResponseError) GetCode() string`

GetCode returns the Code field if non-nil, zero value otherwise.

### GetCodeOk

`func (o *GetHealth503ResponseError) GetCodeOk() (*string, bool)`

GetCodeOk returns a tuple with the Code field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCode

`func (o *GetHealth503ResponseError) SetCode(v string)`

SetCode sets Code field to given value.


### GetMessage

`func (o *GetHealth503ResponseError) GetMessage() string`

GetMessage returns the Message field if non-nil, zero value otherwise.

### GetMessageOk

`func (o *GetHealth503ResponseError) GetMessageOk() (*string, bool)`

GetMessageOk returns a tuple with the Message field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessage

`func (o *GetHealth503ResponseError) SetMessage(v string)`

SetMessage sets Message field to given value.


### GetDetails

`func (o *GetHealth503ResponseError) GetDetails() interface{}`

GetDetails returns the Details field if non-nil, zero value otherwise.

### GetDetailsOk

`func (o *GetHealth503ResponseError) GetDetailsOk() (*interface{}, bool)`

GetDetailsOk returns a tuple with the Details field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDetails

`func (o *GetHealth503ResponseError) SetDetails(v interface{})`

SetDetails sets Details field to given value.

### HasDetails

`func (o *GetHealth503ResponseError) HasDetails() bool`

HasDetails returns a boolean if a field has been set.

### SetDetailsNil

`func (o *GetHealth503ResponseError) SetDetailsNil(b bool)`

 SetDetailsNil sets the value for Details to be an explicit nil

### UnsetDetails
`func (o *GetHealth503ResponseError) UnsetDetails()`

UnsetDetails ensures that no value is present for Details, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


